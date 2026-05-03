using System.IdentityModel.Tokens.Jwt;
using System.Text;
using MassTransit;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Constants;
using ZxcBank.Infrastructure.Data;
using ZxcBank.Infrastructure.Data.Interceptors;
using ZxcBank.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Diagnostics;
using Microsoft.Extensions.Configuration;
using Microsoft.Extensions.Hosting;
using Microsoft.IdentityModel.Tokens;
using ZxcBank.Domain.Entities;
using ZxcBank.Infrastructure.Authentication;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Http;
using Microsoft.Extensions.Primitives;
using Serilog;
using ZxcBank.Infrastructure.Consumers;
using ZxcBank.Infrastructure.Services;

namespace Microsoft.Extensions.DependencyInjection;

public static class DependencyInjection
{
    public static void AddInfrastructureServices(this IHostApplicationBuilder builder)
    {
        var infrastructureLogger = Log.ForContext("Layer", "Infrastructure");

        infrastructureLogger.Information("Startup infrastructure layer...");
        
        string? connectionString = builder.Configuration.GetConnectionString("ZxcBankDb");
        Guard.Against.Null(connectionString, message: "Connection string 'ZxcBankDb' not found.");
        
        AppContext.SetSwitch("Npgsql.EnableLegacyTimestampBehavior", true);

        builder.Services.AddScoped<ISaveChangesInterceptor, AuditableEntityInterceptor>();
        builder.Services.AddScoped<ISaveChangesInterceptor, DispatchDomainEventsInterceptor>();

        builder.Services.AddDbContext<ApplicationDbContext>((sp, options) =>
        {
            options.AddInterceptors(sp.GetServices<ISaveChangesInterceptor>());
            
            options.UseNpgsql(connectionString); 

            options.ConfigureWarnings(warnings => warnings.Ignore(RelationalEventId.PendingModelChangesWarning));
        });


        builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<ApplicationDbContext>());

        builder.Services.AddScoped<ApplicationDbContextInitialiser>();

        builder.Services.AddAuthentication()
            .AddBearerToken(IdentityConstants.BearerScheme);

        builder.Services.AddAuthorizationBuilder();

        builder.Services
            .AddIdentityCore<ApplicationUser>()
            .AddRoles<IdentityRole>()
            .AddEntityFrameworkStores<ApplicationDbContext>()
            .AddApiEndpoints();

        builder.Services.AddSingleton(TimeProvider.System);
        builder.Services.AddTransient<IIdentityService, IdentityService>();

        builder.Services.AddTransient<JwtTokenGenerator>();
        builder.Services.AddTransient<IPasswordHasher<ZxcBank.Domain.Entities.Card>, PasswordHasher<ZxcBank.Domain.Entities.Card>>();
        
        builder.Services.AddMemoryCache();
        builder.Services.AddHttpClient<ICurrencyService, RealCurrencyService>();
        builder.Services.AddHttpClient<IStockService, YahooFinanceStockService>();

        string jwtCookieName = builder.Configuration["JwtSettings:CookieName"] ?? "zxc_access_token";

        builder.Services.AddAuthentication(options =>
            {
                options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
                options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
            })
            .AddJwtBearer(options =>
            {
                options.TokenValidationParameters = new TokenValidationParameters
                {
                    ValidateIssuer = true,
                    ValidateAudience = true,
                    ValidateLifetime = true,
                    ValidateIssuerSigningKey = true,
                    ValidIssuer = builder.Configuration["JwtSettings:Issuer"],
                    ValidAudience = builder.Configuration["JwtSettings:Audience"],
                    IssuerSigningKey = new SymmetricSecurityKey(
                        Encoding.UTF8.GetBytes(builder.Configuration["JwtSettings:Secret"]!))
                };

                options.Events = new JwtBearerEvents
                {
                    // МАГИЯ 1: Проверка Blacklist в Redis при каждом запросе
                    OnTokenValidated = async context =>
                    {
                        // Запрашиваем ICacheService из контейнера DI текущего HTTP-запроса
                        ICacheService cacheService = context.HttpContext.RequestServices.GetRequiredService<ICacheService>();

                        string token = context.SecurityToken switch
                        {
                            JwtSecurityToken jwt => jwt.RawData,
                            Microsoft.IdentityModel.JsonWebTokens.JsonWebToken jwt => jwt.EncodedToken,
                            _ => string.Empty
                        };

                        if (!string.IsNullOrEmpty(token))
                        {
                            string cacheKey = $"blacklist_{token}";
                            bool isBlacklisted = await cacheService.GetValueTask<bool>(cacheKey, context.HttpContext.RequestAborted);
                    
                            if (isBlacklisted)
                            {
                                infrastructureLogger.Warning("Someone used the token from blacklist: {Token}", token);
                                context.Fail("Tento token byl odhlášen (Blacklisted).");
                            }
                        }
                    },

                    // МАГИЯ 2: Поддержка авторизации для SignalR (WebSockets)
                    OnMessageReceived = context =>
                    {
                        StringValues accessToken = context.Request.Query["access_token"];
                        PathString path = context.HttpContext.Request.Path;

                        // Если запрос идет к нашему SignalR Хабу и токен есть в URL
                        if (!string.IsNullOrEmpty(accessToken) && path.StartsWithSegments("/hubs/notifications"))
                        {
                            // Подсовываем токен пайплайну авторизации
                            context.Token = accessToken;
                        }
                        else if (context.Request.Cookies.TryGetValue(jwtCookieName, out string? cookieToken))
                        {
                            context.Token = cookieToken;
                        }

                        return Task.CompletedTask;
                    }
                };
            });

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = builder.Configuration.GetConnectionString("Redis");

        });
        
        builder.Services.AddTransient<ICacheService, RedisCacheService>();
        
        builder.Services.AddMassTransit(x =>
        {
            x.AddConsumer<UserLoggedInConsumer>();
            x.AddConsumer<SuspiciousActivityConsumer>();
            x.AddConsumer<TransferMoneyConsumer>();
            
            x.UsingRabbitMq((context, cfg) =>
            {
                cfg.Host(builder.Configuration.GetConnectionString("RabbitMq"));
            
                cfg.ConfigureEndpoints(context);
            });
        });
        
        builder.Services.AddTransient<IEventPublisher, RabbitMqEventPublisher>();
        
        infrastructureLogger.Information("Infrastructure layer successfully registered!");
    }
}

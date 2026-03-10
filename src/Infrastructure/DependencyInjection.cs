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
using Serilog;
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
            });

        builder.Services.AddStackExchangeRedisCache(options =>
        {
            options.Configuration = builder.Configuration.GetConnectionString("Redis");

        });
        
        builder.Services.AddTransient<ICacheService, RedisCacheService>();
        
        builder.Services.AddMassTransit(x =>
        {
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

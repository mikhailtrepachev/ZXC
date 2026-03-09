using ZxcBank.Infrastructure.Data;
using Scalar.AspNetCore;
using Serilog;

const string consoleTemplate = "[{Timestamp:HH:mm:ss} {Level:u3}] [{Layer}{SourceContext}] - {Message:lj}{NewLine}{Exception}";

// We try to send logs to Seq using the address from Docker. If it is not available, we send them to the hard coded address
Log.Logger = new LoggerConfiguration()
    .Enrich.FromLogContext()
    .WriteTo.Console(outputTemplate: consoleTemplate)
    .WriteTo.Seq(Environment.GetEnvironmentVariable("SEQ_URL") ?? "http://localhost:5341")
    .CreateLogger();

var webLogger = Log.ForContext("Layer", "Web");

try
{
    webLogger.Information("Starting web host...");
    
    WebApplicationBuilder builder = WebApplication.CreateBuilder(args);

// Add services to the container.
    builder.AddKeyVaultIfConfigured();
    builder.AddApplicationServices();
    builder.AddInfrastructureServices();
    builder.AddWebServices();
    builder.Host.UseSerilog();

    var app = builder.Build();

// Configure the HTTP request pipeline.
    if (app.Environment.IsDevelopment())
    {
        await app.InitialiseDatabaseAsync();
    }
    else
    {
        // The default HSTS value is 30 days. You may want to change this for production scenarios, see https://aka.ms/aspnetcore-hsts.
        app.UseHsts();
    }

    app.UseHealthChecks("/health");
    app.UseHttpsRedirection();
    app.UseStaticFiles();

    app.MapOpenApi();
    app.MapScalarApiReference();


    app.UseExceptionHandler(options => { });

    app.Map("/", () => Results.Redirect("/scalar"));

    app.MapEndpoints();

    app.Run();
}
catch (Exception ex)
{
    Log.Fatal(ex, "The server unexpectedly crashed during startup");
    throw;
}
finally
{
    Log.CloseAndFlush();
}


public partial class Program { }

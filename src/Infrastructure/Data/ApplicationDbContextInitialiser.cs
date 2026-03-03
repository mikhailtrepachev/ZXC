using ZxcBank.Domain.Constants;
using ZxcBank.Infrastructure.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Infrastructure.Data;

public static class InitialiserExtensions
{
    public static async Task InitialiseDatabaseAsync(this WebApplication app)
    {
        using var scope = app.Services.CreateScope();

        var initialiser = scope.ServiceProvider.GetRequiredService<ApplicationDbContextInitialiser>();

        await initialiser.InitialiseAsync();
        await initialiser.SeedAsync();
    }
}

public class ApplicationDbContextInitialiser
{
    private readonly ILogger<ApplicationDbContextInitialiser> _logger;
    private readonly ApplicationDbContext _context;
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly RoleManager<IdentityRole> _roleManager;

    public ApplicationDbContextInitialiser(ILogger<ApplicationDbContextInitialiser> logger, ApplicationDbContext context, UserManager<ApplicationUser> userManager, RoleManager<IdentityRole> roleManager)
    {
        _logger = logger;
        _context = context;
        _userManager = userManager;
        _roleManager = roleManager;
    }

    public async Task InitialiseAsync()
    {
        try
        {
            // See https://jasontaylor.dev/ef-core-database-initialisation-strategies
            await _context.Database.EnsureDeletedAsync();
            await _context.Database.EnsureCreatedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while initialising the database.");
            throw;
        }
    }

    public async Task SeedAsync()
    {
        try
        {
            await TrySeedAsync();
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "An error occurred while seeding the database.");
            throw;
        }
    }

    public async Task TrySeedAsync()
    {
        // 1. Создание Ролей
        var administratorRole = new IdentityRole(Roles.Administrator);
        if (_roleManager.Roles.All(r => r.Name != administratorRole.Name))
        {
            await _roleManager.CreateAsync(administratorRole);
        }
        
        var clientRole = new IdentityRole(Roles.Client);
        if (_roleManager.Roles.All(r => r.Name != clientRole.Name))
        {
            await _roleManager.CreateAsync(clientRole);
        }

        var managerRole = new IdentityRole(Roles.Manager);
        if (_roleManager.Roles.All(r => r.Name != managerRole.Name))
        {
            await _roleManager.CreateAsync(managerRole);
        }

        // 2. Создание Администратора
        var administrator = new ApplicationUser { UserName = "administrator@localhost", Email = "administrator@localhost" };

        if (_userManager.Users.All(u => u.UserName != administrator.UserName))
        {
            await _userManager.CreateAsync(administrator, "Administrator1!");
            if (!string.IsNullOrWhiteSpace(administratorRole.Name))
            {
                await _userManager.AddToRolesAsync(administrator, new [] { administratorRole.Name });
            }
        }
        
        // 3. Пользователь SENDER (Богатый)
        var sender = new ApplicationUser { UserName = "sender@bank.com", Email = "sender@bank.com" };
        
        if (_userManager.Users.All(u => u.UserName != sender.UserName))
        {
            await _userManager.CreateAsync(sender, "Password123!");
            await _userManager.AddToRoleAsync(sender, Roles.Client);

            var senderClient = new Client
            {
                UserId = sender.Id,
                DailyTransferLimit = 50000,
                InternetPaymentLimit = 10000
            };
            _context.Clients.Add(senderClient);

            var senderAccount = new Account
            {
                OwnerId = sender.Id,
                AccountNumber = "40817810000000000001", 
                Balance = 100000, 
                IsFrozen = false
            };
            _context.Accounts.Add(senderAccount);
            
            // --- ВАЖНО: СОХРАНЯЕМ ПЕРВОГО КЛИЕНТА ---
            await _context.SaveChangesAsync(); 
        }

        // 4. Пользователь RECEIVER (Получатель)
        var receiver = new ApplicationUser { UserName = "receiver@bank.com", Email = "receiver@bank.com" };

        if (_userManager.Users.All(u => u.UserName != receiver.UserName))
        {
            await _userManager.CreateAsync(receiver, "Password123!");
            await _userManager.AddToRoleAsync(receiver, Roles.Client);

            var receiverClient = new Client
            {
                UserId = receiver.Id,
                DailyTransferLimit = 5000,
                InternetPaymentLimit = 1000
            };
            _context.Clients.Add(receiverClient);

            var receiverAccount = new Account
            {
                OwnerId = receiver.Id,
                AccountNumber = "40817810000000000002",
                Balance = 0,
                IsFrozen = false
            };
            _context.Accounts.Add(receiverAccount);
            
            // --- ВАЖНО: СОХРАНЯЕМ ВТОРОГО КЛИЕНТА ---
            await _context.SaveChangesAsync();
        }
    }
}

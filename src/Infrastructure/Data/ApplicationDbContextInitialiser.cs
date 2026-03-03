using ZxcBank.Domain.Constants;
using ZxcBank.Infrastructure.Identity;
using Microsoft.AspNetCore.Builder;
using Microsoft.AspNetCore.Identity;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Logging;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Enums;

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
        var roles = new[] { Roles.Administrator, Roles.Client, Roles.Manager };
        foreach (var roleName in roles)
        {
            if (roleName != null && !await _roleManager.RoleExistsAsync(roleName))
            {
                await _roleManager.CreateAsync(new IdentityRole(roleName));
            }
        }

        // 2. Создание Администратора
        var adminEmail = "administrator@localhost";
        if (await _userManager.FindByEmailAsync(adminEmail) == null)
        {
            var admin = new ApplicationUser { UserName = adminEmail, Email = adminEmail };
            await _userManager.CreateAsync(admin, "Administrator1!");
            await _userManager.AddToRoleAsync(admin, Roles.Administrator);
        }

        // --- SENDER (Отправитель) ---
        var senderEmail = "sender@bank.com";
        if (await _userManager.FindByEmailAsync(senderEmail) == null)
        {
            var sender = new ApplicationUser { UserName = senderEmail, Email = senderEmail };
            await _userManager.CreateAsync(sender, "Password123!");
            await _userManager.AddToRoleAsync(sender, Roles.Client);

            // Создаем Клиента
            var senderClient = new Client
            {
                UserId = sender.Id,
                DailyTransferLimit = 50000,
                InternetPaymentLimit = 10000,
                FirstName = "Adrei",
                LastName = "Dwwwww",
                State = "Czech",
                Street = "Na honech I 3904",
                PhoneNumber = "+79161231247",
            };

            // Добавляем счет ВНУТРЬ клиента (Связывание)
            senderClient.Accounts.Add(new Account
            {
                OwnerId = sender.Id,
                AccountNumber = "40817810000000000001",
                Balance = 100000,
                IsFrozen = false,
                Currency = Currency.Koruna, // Или RUB, как у вас настроено
                Type = AccountType.Debet
                // ClientId проставится сам!
            });
            
            senderClient.Accounts.Add(new Account
            {
                OwnerId = sender.Id,
                AccountNumber = "40817810034000000001",
                Balance = 23333,
                IsFrozen = false,
                Currency = Currency.Euro, // Или RUB, как у вас настроено
                Type = AccountType.Debet
                // ClientId проставится сам!
            });
            
            senderClient.Accounts.Add(new Account
            {
                OwnerId = sender.Id,
                AccountNumber = "40817810034000088001",
                Balance = 32121,
                IsFrozen = false,
                Currency = Currency.Dollar, // Или RUB, как у вас настроено
                Type = AccountType.Debet
                // ClientId проставится сам!
            });
            
            senderClient.Accounts.Add(new Account
            {
                OwnerId = sender.Id,
                AccountNumber = "40817810034000082201",
                Balance = 32121,
                IsFrozen = false,
                Currency = Currency.Koruna, // Или RUB, как у вас настроено
                Type = AccountType.Investment
                // ClientId проставится сам!
            });

            _context.Clients.Add(senderClient);
            await _context.SaveChangesAsync(); // Сохраняем пачкой
        }

        // --- RECEIVER (Получатель) ---
        var receiverEmail = "receiver@bank.com";
        if (await _userManager.FindByEmailAsync(receiverEmail) == null)
        {
            var receiver = new ApplicationUser { UserName = receiverEmail, Email = receiverEmail };
            await _userManager.CreateAsync(receiver, "Password123!");
            await _userManager.AddToRoleAsync(receiver, Roles.Client);

            // Создаем Клиента
            var receiverClient = new Client
            {
                UserId = receiver.Id,
                DailyTransferLimit = 5000,
                InternetPaymentLimit = 1000,
                FirstName = "Vadim",
                LastName = "Zinoviev",
                State = "Russia",
                Street = "Lenina 15",
                PhoneNumber = "+79161234567",
            };

            // Добавляем счет ВНУТРЬ клиента
            receiverClient.Accounts.Add(new Account
            {
                OwnerId = receiver.Id,
                AccountNumber = "24817810000000000002",
                Balance = 0,
                IsFrozen = false,
                Currency = Currency.Koruna,
                Type = AccountType.Debet
            });
            
            receiverClient.Accounts.Add(new Account
            {
                OwnerId = receiver.Id,
                AccountNumber = "23817810000000000002",
                Balance = 0,
                IsFrozen = false,
                Currency = Currency.Euro,
                Type = AccountType.Debet
            });
            
            receiverClient.Accounts.Add(new Account
            {
                OwnerId = receiver.Id,
                AccountNumber = "21817810000000000002",
                Balance = 0,
                IsFrozen = false,
                Currency = Currency.Dollar,
                Type = AccountType.Debet
            });
            
            receiverClient.Accounts.Add(new Account
            {
                OwnerId = receiver.Id,
                AccountNumber = "22817810000000000002",
                Balance = 0,
                IsFrozen = false,
                Currency = Currency.Koruna,
                Type = AccountType.Investment
            });

            _context.Clients.Add(receiverClient);
            await _context.SaveChangesAsync();
        }
    }

    
    private string GenerateAccountNumber()
    {
        Random random = new Random();
        string part1 = random.Next(100000, 999999).ToString();
        string part2 = random.Next(100000, 999999).ToString();
        
        return $"40817810{part1}{part2}"; // Итого 20 цифр
    }

    private (Domain.Entities.Account, Domain.Entities.Account, Domain.Entities.Account, Domain.Entities.Account) CreateAccounts(string userId)
    {
        Domain.Entities.Account euroAccount = new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(), // Генерируем красивый номер
            Balance = 10000, // Стартовый баланс
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Euro
        };

        Domain.Entities.Account dollarAccount = new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(), // Генерируем красивый номер
            Balance = 4653, // Стартовый баланс
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Dollar
        };
        
        Domain.Entities.Account korunaAccount = new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(), // Генерируем красивый номер
            Balance = 7653, // Стартовый баланс
            IsFrozen = false,
            Type = AccountType.Debet,
            Currency = Currency.Koruna
        };
        
        Domain.Entities.Account investmentAccount = new Domain.Entities.Account
        {
            OwnerId = userId,
            AccountNumber = GenerateAccountNumber(), // Генерируем красивый номер
            Balance = 34432, // Стартовый баланс
            IsFrozen = false,
            Type = AccountType.Investment,
            Currency = Currency.Koruna
        };

        return (euroAccount, dollarAccount, korunaAccount, investmentAccount);
    }
}

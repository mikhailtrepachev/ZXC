using Microsoft.AspNetCore.Identity;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using MediatR; // Не забудь добавить
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace ZxcBank.Application.Cards.Commands.CreateCard;

// Команда (входящие данные)
public record CreateCardCommand : IRequest<int>
{
    public required string AccountNumber { get; init; } // <-- Мы будем искать счет по этому номеру
    public required string PinCode { get; init; }
    public bool IsVirtual { get; init; }
    public decimal? DailyLimit { get; init; }
}

public class CreateCardCommandHandler : IRequestHandler<CreateCardCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly IPasswordHasher<Card> _passwordHasher;
    private readonly IIdentityService _identityService;
    private readonly ILogger<CreateCardCommandHandler> _logger;
    private readonly ICacheService _cacheService;

    public CreateCardCommandHandler(
        IApplicationDbContext context, 
        IUser currentUser, 
        IPasswordHasher<Card> passwordHasher,
        IIdentityService identityService,
        ILogger<CreateCardCommandHandler> logger,
        ICacheService cacheService)
    {
        _context = context;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _identityService = identityService;
        _logger = logger;
        _cacheService = cacheService;
    }

    public async Task<int> Handle(CreateCardCommand request, CancellationToken cancellationToken)
    {
        if (!System.Text.RegularExpressions.Regex.IsMatch(request.PinCode, "^\\d{4}$"))
        {
            throw new Exception("PIN musi mit presne 4 cislice.");
        }

        string? userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // Ищем счет, который принадлежит текущему юзеру И имеет указанный номер
        Domain.Entities.Account? account = await _context.Accounts
            .FirstOrDefaultAsync(a => a.OwnerId == userId && a.AccountNumber == request.AccountNumber, cancellationToken);

        if (account == null) 
        {
            _logger.LogError("Účet s číslem {AccountNumber} nebyl nalezen", request.AccountNumber);
            throw new Exception($"Účet s číslem {request.AccountNumber} nebyl nalezen.");
        }

        int existingCardsCount = await _context.Cards
            .CountAsync(c => c.AccountId == account.Id && c.IsActive, cancellationToken);

        if (existingCardsCount >= 3)
        {
            _logger.LogInformation("Pro účet {UserId} byl dosažen limit karet (maximálně 3)", userId);
            throw new Exception("Pro tento účet byl dosažen limit karet (maximálně 3).");
        }

        Client? client = await _context.Clients
            .FirstOrDefaultAsync(a => a.UserId == userId);

        if (client is null)
        {
            _logger.LogError("Client {ClientId} nebyl nalezen", userId);
            throw new Exception("Nebyl nalezen klient");
        }

        string? fullName = $"{client.LastName} {client.FirstName}";
        
        string lockKey = $"card_creation_lock_{userId}_{request.AccountNumber}";
        
        bool isProcessing = await _cacheService.GetValueTask<bool>(lockKey, cancellationToken);

        if (isProcessing)
        {
            _logger.LogWarning("Double card creation has been detected: {UserId}", userId);
            throw new Exception("Vase karta se prave zpracovava, pockejte prosim nekolik sekund");
        }
        
        // we will set the lock in redis for 3 seconds for the current money transfer
        await _cacheService.SetValueTask(
            lockKey, true, TimeSpan.FromSeconds(3), cancellationToken);

        Card card = new Card
        {
            AccountId = account.Id, // Привязываем к найденному ID
            CardHolderName = (fullName ?? "CLIENT").ToUpper(),
            CardNumber = GenerateCardNumber(),
            Cvv = new Random().Next(100, 999).ToString(),
            ExpiryDate = DateTime.Now.AddYears(4).ToString("MM/yy"),
            IsVirtual = request.IsVirtual,
            IsActive = true,
            IsTemporarilyBlocked = false,
            DailyLimit = request.DailyLimit is > 0 and <= 500000 ? request.DailyLimit.Value : 50000
        };

        // 5. Хешируем ПИН
        card.PinCodeHash = _passwordHasher.HashPassword(card, request.PinCode);

        _context.Cards.Add(card);
        await _context.SaveChangesAsync(cancellationToken);

        return card.Id;
    }

    private string GenerateCardNumber()
    {
        Random rnd = new Random();
        
        return $"4200{rnd.Next(1000, 9999)}{rnd.Next(1000, 9999)}{rnd.Next(1000, 9999)}";
    }
}

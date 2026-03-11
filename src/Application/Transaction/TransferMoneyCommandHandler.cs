using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Transaction;

public record TransferMoneyCommand : IRequest<int>
{
    public required string FromAccountNumber { get; init; }
    public required string ToAccountNumber { get; init; }
    public decimal Amount { get; init; }
    public string? Message { get; init; }
}

public class TransferMoneyCommandHandler : IRequestHandler<TransferMoneyCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly ICurrencyService _currencyService;
    private readonly IEventPublisher _eventPublisher;
    private readonly ICacheService _cacheService;
    private readonly ILogger<TransferMoneyCommandHandler> _logger;

    public TransferMoneyCommandHandler(
        IApplicationDbContext context,
        IUser currentUser,
        ICurrencyService currencyService,
        IEventPublisher eventPublisher,
        ICacheService cacheService,
        ILogger<TransferMoneyCommandHandler> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _currencyService = currencyService;
        _eventPublisher = eventPublisher;
        _cacheService = cacheService; 
        _logger = logger;
    }

    public async Task<int> Handle(TransferMoneyCommand request, CancellationToken cancellationToken)
    {
        // 1. Базовая валидация
        if (request.Amount <= 0)
        {
            throw new Exception("Castka prevodu musi byt kladna.");
        }

        string? userId = _currentUser.Id;
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException();
        }
        
        string lockKey = $"transfer_lock_{userId}_{request.ToAccountNumber}_{request.Amount}";
        
        bool isProcessing = await _cacheService.GetValueTask<bool>(lockKey, cancellationToken);

        if (isProcessing)
        {
            _logger.LogWarning("Double money transfer request has been detected {UserId}", userId);
            throw new Exception("Váš převod se právě zpracovává. Prosím, vyčkejte několik sekund.");
        }
        
        // we will set the lock in redis for 3 seconds for the current money transfer
        await _cacheService.SetValueTask(
            lockKey, true, TimeSpan.FromSeconds(3), cancellationToken);

        Client? client = await _context.Clients
            .Include(c => c.Accounts)
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

        if (client == null)
        {
            _logger.LogError("Client not found for user {UserId}", userId);
            throw new Exception("Profil klienta nebyl nalezen.");
        }

        // 3. Ищем счет ОТПРАВИТЕЛЯ внутри счетов клиента
        Domain.Entities.Account? senderAccount = client.Accounts
            .FirstOrDefault(a => a.AccountNumber == request.FromAccountNumber);

        if (senderAccount == null)
        {
            _logger.LogError("Sender account not found for user {UserId}", userId);
            throw new Exception("Ucet pro odepsani nebyl nalezen nebo vam nepatri.");
        }

        if (senderAccount.IsFrozen)
        {
            _logger.LogInformation("Sender account is frozen for user {UserId}", userId);
            throw new Exception("Vas ucet je zablokovan. Kontaktujte podporu.");
        }

        if (senderAccount.Balance < request.Amount)
        {
            _logger.LogInformation("Insufficient funds for user {UserId}", userId);
            throw new Exception("Na uctu neni dostatek prostredku.");
        }

        DateTime startOfDay = DateTime.UtcNow.Date;
        
        List<string> clientAccountNumbers = client.Accounts.Select(a => a.AccountNumber).ToList();

        decimal spentToday = await _context.Transactions
            .Where(t => clientAccountNumbers.Contains(t.FromAccountId) && t.Created >= startOfDay)
            .SumAsync(t => t.Amount, cancellationToken);

        if (spentToday + request.Amount > client.DailyTransferLimit)
        {
            _logger.LogInformation("Daily transfer limit exceeded for user {UserId}", userId);
            throw new Exception($"Prekrocen denni limit. Vas limit: {client.DailyTransferLimit}. Dnes utraceno: {spentToday}.");
        }

        Domain.Entities.Account? receiverAccount = await _context.Accounts
            .Include(a => a.Client)
            .FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber, cancellationToken);

        if (receiverAccount == null)
        {
            _logger.LogError("Receiver account not found for user {UserId}", userId);
            throw new Exception("Ucet prijemce nebyl nalezen.");
        }

        if (receiverAccount.IsFrozen)
        {
            _logger.LogInformation("Receiver account is frozen for user {UserId}", userId);
            throw new Exception("Ucet prijemce je zablokovan.");
        }

        if (senderAccount.Id == receiverAccount.Id)
        {
            throw new Exception("Nelze prevadet penize sami sobe na stejny ucet.");
        }

        // 6. Подготовка сообщения
        string normalizedMessage = (request.Message ?? string.Empty).Trim();
        if (normalizedMessage.Length > 140)
        {
            _logger.LogInformation("Message length exceeds limit for user {UserId}", userId);
            throw new Exception("Zprava k prevodu muze mit maximalne 140 znaku.");
        }

        decimal amountToDebit = request.Amount;
        decimal amountToCredit = request.Amount;

        string description = string.IsNullOrWhiteSpace(normalizedMessage)
            ? $"Prevod na {request.ToAccountNumber}"
            : $"Prevod na {request.ToAccountNumber}: {normalizedMessage}";

        if (senderAccount.Currency != receiverAccount.Currency)
        {
            amountToCredit = await _currencyService.ConvertAsync(
                request.Amount,
                senderAccount.Currency,
                receiverAccount.Currency);

            amountToCredit = Math.Round(amountToCredit, 2);
            description += $" (Konverze: {request.Amount} {senderAccount.Currency} -> {amountToCredit} {receiverAccount.Currency})";
        }

        // 8. Выполнение перевода
        senderAccount.Balance -= amountToDebit;
        receiverAccount.Balance += amountToCredit;

        Domain.Entities.Transaction transaction = new Domain.Entities.Transaction
        {
            FromAccountId = senderAccount.AccountNumber,
            ToAccountId = receiverAccount.AccountNumber,
            Amount = amountToDebit,
            Description = description,
        };
        
        _context.Transactions.Add(transaction);
        await _context.SaveChangesAsync(cancellationToken);

        await _eventPublisher.PublishAsync(new MoneyTransferredEvent(
            SenderId: userId,
            ReceiverId: receiverAccount.Client.UserId,
            Amount: request.Amount,
            Message: description,
            Timestamp: DateTime.UtcNow
        ), cancellationToken);
        
        return transaction.Id;
    }
}

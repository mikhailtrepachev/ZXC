using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

namespace Microsoft.Extensions.DependencyInjection.Auth.Account;

public record TransferMoneyCommand : IRequest<int>
{
    public required string ToAccountNumber { get; init; } // Номер счета получателя (строка 20 цифр)
    public decimal Amount { get; init; }
}

public class TransferMoneyCommandHandler : IRequestHandler<TransferMoneyCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser; // Сервис для получения ID из токена

    public TransferMoneyCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<int> Handle(TransferMoneyCommand request, CancellationToken cancellationToken)
    {
        // 0. Валидация суммы
        if (request.Amount <= 0) throw new Exception("Value must be positive");

        // 1. Находим счет ОТПРАВИТЕЛЯ (того, кто залогинен)
        // Для хакатона берем первый попавшийся счет юзера
        string? senderId = _currentUser.Id; 
        if (senderId == null) throw new UnauthorizedAccessException();

        ZxcBank.Domain.Entities.Account? senderAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.OwnerId == senderId, cancellationToken);
        
        if (senderAccount == null) throw new Exception("У вас нет счета для списания");

        if (senderAccount.IsFrozen) throw new Exception("Your account is frozen. Please contact support.");

        // 2. Находим счет ПОЛУЧАТЕЛЯ по номеру
        var receiverAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber, cancellationToken);

        if (receiverAccount == null) throw new Exception("Счет получателя не найден");
        
        if (receiverAccount.IsFrozen) throw new Exception("This account is frozen. Please contact support.");

        // 3. Проверка: Нельзя переводить самому себе (опционально)
        if (senderAccount.Id == receiverAccount.Id) 
            throw new Exception("Нельзя переводить самому себе на тот же счет");

        // 4. Проверка БАЛАНСА
        if (senderAccount.Balance < request.Amount) 
            throw new Exception("Недостаточно средств");

        // --- НАЧАЛО ТРАНЗАКЦИИ (БИЗНЕС-ЛОГИКА) ---

        // Списываем у одного
        senderAccount.Balance -= request.Amount;

        // Начисляем другому
        receiverAccount.Balance += request.Amount;

        // Записываем в историю
        Transaction transaction = new Transaction
        {
            FromAccountId = senderAccount.AccountNumber,
            ToAccountId = receiverAccount.AccountNumber,
            Amount = request.Amount,
            Description = $"Money transfer to {request.ToAccountNumber}"
        };

        _context.Transactions.Add(transaction);

        // Сохраняем ВСЁ разом. Если тут упадет ошибка, база откатится сама.
        await _context.SaveChangesAsync(cancellationToken);

        return transaction.Id;
    }
}

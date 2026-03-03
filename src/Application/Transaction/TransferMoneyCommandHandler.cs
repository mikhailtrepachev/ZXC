using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Transactions.Commands.TransferMoney;

public record TransferMoneyCommand : IRequest<int>
{
    public required string FromAccountNumber { get; init; } // <-- НОВОЕ ПОЛЕ (Откуда)
    public required string ToAccountNumber { get; init; }   // (Куда)
    public decimal Amount { get; init; }
}

public class TransferMoneyCommandHandler : IRequestHandler<TransferMoneyCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly ICurrencyService _currencyService; // Сервис валют

    public TransferMoneyCommandHandler(
        IApplicationDbContext context, 
        IUser currentUser,
        ICurrencyService currencyService)
    {
        _context = context;
        _currentUser = currentUser;
        _currencyService = currencyService;
    }

    public async Task<int> Handle(TransferMoneyCommand request, CancellationToken cancellationToken)
    {
        // 0. Валидация
        if (request.Amount <= 0) throw new Exception("Сумма перевода должна быть положительной");

        string? userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // 1. Ищем счет ОТПРАВИТЕЛЯ
        // БЕЗОПАСНОСТЬ: Ищем по номеру счета И по ID владельца.
        // Если пользователь попытается списать с чужого счета, запрос вернет null.
        var senderAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.AccountNumber == request.FromAccountNumber && a.OwnerId == userId, cancellationToken);
        
        if (senderAccount == null) 
            throw new Exception("Счет списания не найден или не принадлежит вам.");

        if (senderAccount.IsFrozen) 
            throw new Exception("Ваш счет заморожен. Обратитесь в поддержку.");
        
        if (senderAccount.Balance < request.Amount) 
            throw new Exception("Недостаточно средств на счете.");

        // 2. Ищем счет ПОЛУЧАТЕЛЯ
        var receiverAccount = await _context.Accounts
            .FirstOrDefaultAsync(a => a.AccountNumber == request.ToAccountNumber, cancellationToken);

        if (receiverAccount == null) 
            throw new Exception("Счет получателя не найден.");
        
        if (receiverAccount.IsFrozen) 
            throw new Exception("Счет получателя заморожен.");

        // 3. Проверка на перевод самому себе (на тот же счет)
        if (senderAccount.Id == receiverAccount.Id) 
            throw new Exception("Нельзя переводить самому себе на тот же счет.");

        // --- ЛОГИКА КОНВЕРТАЦИИ ---
        decimal amountToDebit = request.Amount;   // Списываем сколько ввел юзер
        decimal amountToCredit = request.Amount;  // Зачисляем (по умолчанию столько же)
        string description = $"Перевод на {request.ToAccountNumber}";

        if (senderAccount.Currency != receiverAccount.Currency)
        {
            // Конвертация через наш сервис
            amountToCredit = await _currencyService.ConvertAsync(
                request.Amount, 
                senderAccount.Currency, 
                receiverAccount.Currency
            );

            // Округляем до копеек
            amountToCredit = Math.Round(amountToCredit, 2);
            
            description += $" (Конвертация: {request.Amount} {senderAccount.Currency} -> {amountToCredit} {receiverAccount.Currency})";
        }

        // 4. Выполняем транзакцию (Меняем балансы)
        senderAccount.Balance -= amountToDebit;
        receiverAccount.Balance += amountToCredit;

        // 5. Сохраняем историю
        var transaction = new Domain.Entities.Transaction
        {
            FromAccountId = senderAccount.AccountNumber,   // Используем ID для связи (Foreign Key)
            ToAccountId = receiverAccount.AccountNumber,   // Используем ID для связи
            Amount = amountToDebit,             // Пишем сумму списания
            Description = description
        };

        _context.Transactions.Add(transaction);

        // Сохраняем изменения в БД (транзакционно)
        await _context.SaveChangesAsync(cancellationToken);

        return transaction.Id;
    }
}

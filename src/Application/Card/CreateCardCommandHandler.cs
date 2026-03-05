using Microsoft.AspNetCore.Identity;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;
using MediatR; // Не забудь добавить
using Microsoft.EntityFrameworkCore;

namespace ZxcBank.Application.Cards.Commands.CreateCard;

// Команда (входящие данные)
public record CreateCardCommand : IRequest<int>
{
    public required string AccountNumber { get; init; } // <-- Мы будем искать счет по этому номеру
    public required string PinCode { get; init; }
    public bool IsVirtual { get; init; }
}

public class CreateCardCommandHandler : IRequestHandler<CreateCardCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly IPasswordHasher<Card> _passwordHasher;
    private readonly IIdentityService _identityService;

    public CreateCardCommandHandler(
        IApplicationDbContext context, 
        IUser currentUser, 
        IPasswordHasher<Card> passwordHasher,
        IIdentityService identityService)
    {
        _context = context;
        _currentUser = currentUser;
        _passwordHasher = passwordHasher;
        _identityService = identityService;
    }

    public async Task<int> Handle(CreateCardCommand request, CancellationToken cancellationToken)
    {
        var userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // Ищем счет, который принадлежит текущему юзеру И имеет указанный номер
        var account = await _context.Accounts
            .FirstOrDefaultAsync(a => a.OwnerId == userId && a.AccountNumber == request.AccountNumber, cancellationToken);

        if (account == null) 
        {
            // Важно не говорить "Счет чужой", лучше просто "Не найден" для безопасности
            throw new Exception($"Účet s číslem {request.AccountNumber} nebyl nalezen.");
        }

        // 2. Проверка лимита (3 карты на один счет)
        var existingCardsCount = await _context.Cards
            .CountAsync(c => c.AccountId == account.Id && c.IsActive, cancellationToken);

        if (existingCardsCount >= 3)
        {
            throw new Exception("Pro tento účet byl dosažen limit karet (maximálně 3).");
        }

        var client = await _context.Clients
            .FirstOrDefaultAsync(a => a.UserId == userId);

        if (client is null )
        {
            throw new Exception("Nebyl nalezen klient");
        }

        var fullName = $"{client.LastName} {client.FirstName}";

        // 4. Создаем карту
        var card = new Card
        {
            AccountId = account.Id, // Привязываем к найденному ID
            CardHolderName = (fullName ?? "CLIENT").ToUpper(),
            CardNumber = GenerateCardNumber(),
            Cvv = new Random().Next(100, 999).ToString(),
            ExpiryDate = DateTime.Now.AddYears(4).ToString("MM/yy"),
            IsVirtual = request.IsVirtual,
            IsActive = true
        };

        // 5. Хешируем ПИН
        card.PinCodeHash = _passwordHasher.HashPassword(card, request.PinCode);

        _context.Cards.Add(card);
        await _context.SaveChangesAsync(cancellationToken);

        return card.Id;
    }

    private string GenerateCardNumber()
    {
        var rnd = new Random();
        // 4200 - Visa Classic
        return $"4200{rnd.Next(1000, 9999)}{rnd.Next(1000, 9999)}{rnd.Next(1000, 9999)}";
    }
}

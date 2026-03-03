using Microsoft.AspNetCore.Identity;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Domain.Entities;

public record CreateCardCommand : IRequest<int>
{
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

        // 1. Ищем счет пользователя
        var account = await _context.Accounts
            .Include(a => a.Cards) // Подгружаем карты, чтобы посчитать их (или используем CountAsync ниже)
            .FirstOrDefaultAsync(a => a.OwnerId == userId, cancellationToken);

        if (account == null) throw new Exception("Счет не найден");

        // 2. --- ПРОВЕРКА ЛИМИТА ---
        // Считаем, сколько АКТИВНЫХ карт уже есть у этого счета
        var existingCardsCount = await _context.Cards
            .CountAsync(c => c.AccountId == account.Id && c.IsActive, cancellationToken);

        if (existingCardsCount >= 3)
        {
            throw new Exception("Достигнут лимит карт (максимум 3). Заблокируйте старую карту, чтобы выпустить новую.");
        }
        // ---------------------------

        // 3. Получаем имя для карты
        var userName = await _identityService.GetUserNameAsync(userId);

        // 4. Создаем карту
        var card = new Card
        {
            AccountId = account.Id,
            CardHolderName = (userName ?? "CLIENT").ToUpper(),
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

using MediatR;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Admin;

public record DeleteAccountCommand(int AccountId) : IRequest;

public class DeleteAccountCommandHandler : IRequestHandler<DeleteAccountCommand>
{
    private readonly IApplicationDbContext _context;

    public DeleteAccountCommandHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task Handle(DeleteAccountCommand request, CancellationToken cancellationToken)
    {
        // Ищем аккаунт в базе
        var account = await _context.Accounts.FindAsync(new object[] { request.AccountId }, cancellationToken);

        if (account == null) throw new Exception("Účet nebyl nalezen");

        // Удаляем
        _context.Accounts.Remove(account);
        await _context.SaveChangesAsync(cancellationToken);
    }
}

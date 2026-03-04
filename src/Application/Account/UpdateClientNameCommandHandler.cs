using System;
using System.Collections.Generic;
using System.Text;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Account;

public record UpdateClientNameCommand : IRequest
{
    public required string FirstName { get; set; }
    public required string LastName { get; set; }
}

internal class UpdateClientNameCommandHandler : IRequestHandler<UpdateClientNameCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public UpdateClientNameCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateClientNameCommand request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        // Ищем запись в таблице Clients, привязанную к этому юзеру
        Domain.Entities.Client? client = await _context.Clients
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

        if (client == null)
        {
            throw new Exception("Ucet klienta nebyl nalezen");
        }

        client.FirstName = request.FirstName;
        client.LastName = request.LastName;

        await _context.SaveChangesAsync(cancellationToken);
    }
}

using System;
using System.Collections.Generic;
using System.Text;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Account;

public record UpdateLimitsCommand : IRequest
{
    public decimal DailyTransferLimit { get; init; }
}
internal class UpdateLimitsCommandHandler : IRequestHandler<UpdateLimitsCommand>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public UpdateLimitsCommandHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task Handle(UpdateLimitsCommand request, CancellationToken cancellationToken)
    {
        if (request.DailyTransferLimit < 0)
        {
            throw new Exception("Limity nemuzou byt negativni!");
        }

        var userId = _currentUser.Id;
        if (userId == null) throw new UnauthorizedAccessException();

        var client = await _context.Clients
            .FirstOrDefaultAsync(c => c.UserId == userId, cancellationToken);

        if (client == null) throw new Exception("Client profile not found.");

        client.DailyTransferLimit = request.DailyTransferLimit;

        await _context.SaveChangesAsync(cancellationToken);
    }
}

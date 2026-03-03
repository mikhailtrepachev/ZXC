using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<Manager> Managers { get; }
    DbSet<Domain.Entities.Account> Accounts { get; }
    DbSet<Domain.Entities.Transaction> Transactions { get; }
    DbSet<UserSession> UserSessions { get; }
    DbSet<Card> Cards { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<Manager> Managers { get; }
    DbSet<Domain.Entities.Account> Accounts { get; }
    DbSet<Domain.Entities.Transaction> Transactions { get; }
    DbSet<UserSession> UserSessions { get; }
    DbSet<Notification> Notifications { get; }
    DbSet<Card> Cards { get; }
    DbSet<Stock> Stocks { get; }
    DbSet<Portfolio> Portfolios { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

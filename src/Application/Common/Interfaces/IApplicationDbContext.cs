using ZxcBank.Domain.Entities;

namespace ZxcBank.Application.Common.Interfaces;

public interface IApplicationDbContext
{
    DbSet<Client> Clients { get; }
    DbSet<Manager> Managers { get; }
    DbSet<Account> Accounts { get; }
    Task<int> SaveChangesAsync(CancellationToken cancellationToken);
}

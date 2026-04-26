using System.Reflection;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Infrastructure.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Infrastructure.Data;

public class ApplicationDbContext : IdentityDbContext<ApplicationUser>, IApplicationDbContext
{
    public DbSet<Client> Clients => Set<Client>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Manager> Managers => Set<Manager>();
    public DbSet<Child> Children => Set<Child>();
    public DbSet<UserSession> UserSessions => Set<UserSession>();
    public DbSet<Stock> Stocks => Set<Stock>();
    public DbSet<Portfolio> Portfolios => Set<Portfolio>();

    public DbSet<Notification> Notifications => Set<Notification>();
    public DbSet<Card> Cards => Set<Card>();
    
    public ApplicationDbContext(DbContextOptions<ApplicationDbContext> options) : base(options) { }

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);
        builder.ApplyConfigurationsFromAssembly(Assembly.GetExecutingAssembly());
    }
}

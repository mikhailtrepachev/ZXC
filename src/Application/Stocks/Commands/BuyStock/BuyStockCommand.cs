using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Stocks.Events;
using ZxcBank.Domain.Entities;
using ZxcBank.Domain.Enums;

namespace ZxcBank.Application.Stocks.Commands.BuyStock;

public record BuyStockCommand(int AccountId, string TickerName, decimal Quantity) : IRequest<int>;

public class BuyStockCommandHandler : IRequestHandler<BuyStockCommand, int>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;
    private readonly IEventPublisher _eventPublisher;
    private readonly ICacheService _cacheService;
    private readonly ILogger<BuyStockCommandHandler> _logger;

    public BuyStockCommandHandler(
        IApplicationDbContext context, 
        IUser currentUser,
        IEventPublisher eventPublisher,
        ICacheService cacheService,
        ILogger<BuyStockCommandHandler> logger)
    {
        _context = context;
        _currentUser = currentUser;
        _eventPublisher = eventPublisher;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<int> Handle(BuyStockCommand request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        if (string.IsNullOrEmpty(userId))
        {
            _logger.LogWarning("BuyStock failed: user is unauthorized");
            throw new UnauthorizedAccessException("User is not authenticated");
        }

        _logger.LogInformation("User {UserId} is attempting to buy {Quantity} of {TickerName} using Account {AccountId}", 
            userId, request.Quantity, request.TickerName, request.AccountId);

        Domain.Entities.Account? account = await _context.Accounts
            .FirstOrDefaultAsync(a => a.Id == request.AccountId && a.OwnerId == userId, cancellationToken);

        if (account == null || account.IsFrozen)
        {
            _logger.LogWarning("BuyStock failed: Account {AccountId} not found or frozen for User {UserId}", request.AccountId, userId);
            throw new Exception("Account not found or is frozen.");
        }

        Stock? stock = await _context.Stocks
            .FirstOrDefaultAsync(s => s.TickerName == request.TickerName, cancellationToken);

        if (stock == null)
        {
            _logger.LogWarning("BuyStock failed: Stock ticker {TickerName} not found", request.TickerName);
            throw new Exception($"Stock {request.TickerName} not found.");
        }

        decimal totalCost = stock.Price * request.Quantity;

        if (account.Balance < totalCost)
        {
            _logger.LogWarning("BuyStock failed: Insufficient funds. Balance: {Balance}, Cost: {Cost}", account.Balance, totalCost);
            throw new Exception("Insufficient funds.");
        }

        account.Balance -= totalCost;

        Portfolio? portfolioItem = await _context.Portfolios
            .FirstOrDefaultAsync(p => p.UserId == userId && p.TickerName == request.TickerName, cancellationToken);

        if (portfolioItem != null)
        {
            decimal currentTotalValue = portfolioItem.Quantity * portfolioItem.AveragePurchasePrice;
            decimal newTotalValue = currentTotalValue + totalCost;
            
            portfolioItem.Quantity += request.Quantity;
            portfolioItem.AveragePurchasePrice = newTotalValue / portfolioItem.Quantity;
        }
        else
        {
            portfolioItem = new Portfolio
            {
                UserId = userId,
                TickerName = stock.TickerName,
                Quantity = request.Quantity,
                AveragePurchasePrice = stock.Price
            };
            _context.Portfolios.Add(portfolioItem);
        }

        Domain.Entities.Transaction transaction = new Domain.Entities.Transaction
        {
            Amount = totalCost,
            FromAccountId = account.Id.ToString(),
            ToAccountId = account.Id.ToString(),
            Status = TransactionStatus.Approved,
            Description = $"Buy {request.Quantity} of {request.TickerName}"
        };
        _context.Transactions.Add(transaction);

        await _context.SaveChangesAsync(cancellationToken);
        
        _logger.LogInformation("BuyStock success: User {UserId} bought {Quantity} of {TickerName}. Portfolio ID: {PortfolioId}", 
            userId, request.Quantity, request.TickerName, portfolioItem.Id);

        string cacheKey = $"Portfolio_{userId}";
        await _cacheService.RemoveAsync(cacheKey, cancellationToken);

        StockBoughtEvent stockEvent = new StockBoughtEvent
        {
            UserId = userId,
            TickerName = request.TickerName,
            Quantity = request.Quantity,
            TotalCost = totalCost,
            PurchasedAt = DateTime.UtcNow
        };

        await _eventPublisher.PublishAsync(stockEvent, cancellationToken);

        return portfolioItem.Id;
    }
}

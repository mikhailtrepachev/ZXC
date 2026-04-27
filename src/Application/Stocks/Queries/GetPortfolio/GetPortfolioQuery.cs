using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Stocks.Queries.GetPortfolio;

public record PortfolioItemDto
{
    public string TickerName { get; init; } = string.Empty;
    public string CompanyName { get; init; } = string.Empty;
    public decimal Quantity { get; init; }
    public decimal AveragePurchasePrice { get; init; }
    public decimal CurrentPrice { get; init; }
    public decimal MarketValue { get; init; }
    public decimal GainLoss { get; init; }
}

public record GetPortfolioQuery : IRequest<List<PortfolioItemDto>>;

public class GetPortfolioQueryHandler : IRequestHandler<GetPortfolioQuery, List<PortfolioItemDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IUser _currentUser;

    public GetPortfolioQueryHandler(IApplicationDbContext context, IUser currentUser)
    {
        _context = context;
        _currentUser = currentUser;
    }

    public async Task<List<PortfolioItemDto>> Handle(GetPortfolioQuery request, CancellationToken cancellationToken)
    {
        string? userId = _currentUser.Id;
        if (string.IsNullOrWhiteSpace(userId))
        {
            throw new UnauthorizedAccessException("User is not authenticated.");
        }

        var portfolioItems = await _context.Portfolios
            .AsNoTracking()
            .Where(item => item.UserId == userId)
            .OrderBy(item => item.TickerName)
            .ToListAsync(cancellationToken);

        if (portfolioItems.Count == 0)
        {
            return new List<PortfolioItemDto>();
        }

        var tickers = portfolioItems
            .Select(item => item.TickerName)
            .Distinct()
            .ToList();

        var stocksByTicker = await _context.Stocks
            .AsNoTracking()
            .Where(stock => tickers.Contains(stock.TickerName))
            .ToDictionaryAsync(stock => stock.TickerName, cancellationToken);

        return portfolioItems.Select(item =>
        {
            stocksByTicker.TryGetValue(item.TickerName, out var stock);
            decimal currentPrice = stock?.Price ?? item.AveragePurchasePrice;
            decimal marketValue = currentPrice * item.Quantity;
            decimal gainLoss = (currentPrice - item.AveragePurchasePrice) * item.Quantity;

            return new PortfolioItemDto
            {
                TickerName = item.TickerName,
                CompanyName = stock?.CompanyName ?? item.TickerName,
                Quantity = item.Quantity,
                AveragePurchasePrice = item.AveragePurchasePrice,
                CurrentPrice = currentPrice,
                MarketValue = marketValue,
                GainLoss = gainLoss
            };
        }).ToList();
    }
}

using System.Collections.Generic;
using System.Linq;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Stocks.Queries.GetStocks;

public record StockItemDto
{
    public int Id { get; init; }
    public string TickerName { get; init; } = string.Empty;
    public string CompanyName { get; init; } = string.Empty;
    public decimal Price { get; init; }
}

public record GetStocksQuery(int PageNumber = 1, int PageSize = 10) : IRequest<List<StockItemDto>>;

public class GetStocksQueryHandler : IRequestHandler<GetStocksQuery, List<StockItemDto>>
{
    private readonly IApplicationDbContext _context;
    private static readonly (string Ticker, string Company, decimal Price)[] DefaultStocks =
    [
        ("AAPL", "Apple Inc.", 175.50M),
        ("MSFT", "Microsoft Corp.", 330.20M),
        ("GOOGL", "Alphabet Inc.", 135.40M),
        ("AMZN", "Amazon.com Inc.", 125.80M),
        ("TSLA", "Tesla Inc.", 240.60M),
        ("META", "Meta Platforms Inc.", 295.10M),
        ("NVDA", "NVIDIA Corp.", 420.30M),
        ("JPM", "JPMorgan Chase & Co.", 145.90M),
        ("V", "Visa Inc.", 230.15M),
        ("WMT", "Walmart Inc.", 160.25M)
    ];

    public GetStocksQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<StockItemDto>> Handle(GetStocksQuery request, CancellationToken cancellationToken)
    {
        await EnsureStockCatalogAsync(cancellationToken);

        int skip = request.PageSize * (request.PageNumber - 1);

        List<ZxcBank.Domain.Entities.Stock> stocks = await _context.Stocks
            .AsNoTracking()
            .OrderBy(s => s.TickerName)
            .Skip(skip)
            .Take(request.PageSize)
            .ToListAsync(cancellationToken);

        List<StockItemDto> result = stocks.Select(s => new StockItemDto
        {
            Id = s.Id,
            TickerName = s.TickerName,
            CompanyName = s.CompanyName,
            Price = s.Price
        }).ToList();

        return result;
    }

    private async Task EnsureStockCatalogAsync(CancellationToken cancellationToken)
    {
        if (await _context.Stocks.AnyAsync(cancellationToken))
        {
            return;
        }

        _context.Stocks.AddRange(DefaultStocks.Select(stock => new ZxcBank.Domain.Entities.Stock
        {
            TickerName = stock.Ticker,
            CompanyName = stock.Company,
            Price = stock.Price
        }));

        await _context.SaveChangesAsync(cancellationToken);
    }
}

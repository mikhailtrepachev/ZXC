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

    public GetStocksQueryHandler(IApplicationDbContext context)
    {
        _context = context;
    }

    public async Task<List<StockItemDto>> Handle(GetStocksQuery request, CancellationToken cancellationToken)
    {
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
}
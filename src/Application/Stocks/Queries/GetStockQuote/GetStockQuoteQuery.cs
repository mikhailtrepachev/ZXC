using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Stocks.Events;

namespace ZxcBank.Application.Stocks.Queries.GetStockQuote;

public record GetStockQuoteQuery(string Ticker) : IRequest<StockQuoteDto>;

public class GetStockQuoteQueryHandler : IRequestHandler<GetStockQuoteQuery, StockQuoteDto>
{
    private readonly IStockService _stockService;
    private readonly ICacheService _cacheService;
    private readonly IEventPublisher _eventPublisher;
    private readonly IApplicationDbContext _context;

    public GetStockQuoteQueryHandler(
        IStockService stockService, 
        ICacheService cacheService, 
        IEventPublisher eventPublisher,
        IApplicationDbContext context)
    {
        _stockService = stockService;
        _cacheService = cacheService;
        _eventPublisher = eventPublisher;
        _context = context;
    }

    public async Task<StockQuoteDto> Handle(GetStockQuoteQuery request, CancellationToken cancellationToken)
    {
        string ticker = request.Ticker.Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(ticker))
        {
            throw new InvalidOperationException("Ticker is required.");
        }

        string cacheKey = $"StockQuote_{ticker}";

        // 1. Ищем в Redis
        StockQuoteDto? quoteDto = await _cacheService.GetValueTask<StockQuoteDto>(cacheKey, cancellationToken);
        
        if (quoteDto == null)
        {
            // 2. Если нет в Redis, идем в API
            try
            {
                quoteDto = await _stockService.GetQuoteAsync(ticker, cancellationToken);
            }
            catch (Exception) when (!cancellationToken.IsCancellationRequested)
            {
                var stock = await _context.Stocks
                    .AsNoTracking()
                    .FirstOrDefaultAsync(s => s.TickerName == ticker, cancellationToken);

                if (stock == null)
                {
                    throw new InvalidOperationException($"Stock {ticker} not found.");
                }

                quoteDto = new StockQuoteDto
                {
                    Ticker = stock.TickerName,
                    CurrentPrice = stock.Price,
                    ChangePercent = 0,
                    Currency = "USD"
                };
            }

            // Сохраняем в Redis на 5 минут
            TimeSpan expiration = TimeSpan.FromMinutes(5);
            await _cacheService.SetValueTask(cacheKey, quoteDto, expiration, cancellationToken);
        }

        // 3. Отправляем событие в RabbitMQ
        StockQuoteFetchedEvent stockEvent = new StockQuoteFetchedEvent
        {
            Ticker = quoteDto.Ticker,
            Price = quoteDto.CurrentPrice,
            FetchedAt = DateTime.UtcNow
        };

        try
        {
            await _eventPublisher.PublishAsync(stockEvent, cancellationToken);
        }
        catch (Exception) when (!cancellationToken.IsCancellationRequested)
        {
        }

        return quoteDto;
    }
}

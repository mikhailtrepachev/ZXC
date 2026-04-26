using System;
using System.Threading;
using System.Threading.Tasks;
using MediatR;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Stocks.Events;

namespace ZxcBank.Application.Stocks.Queries.GetStockQuote;

public record GetStockQuoteQuery(string Ticker) : IRequest<StockQuoteDto>;

public class GetStockQuoteQueryHandler : IRequestHandler<GetStockQuoteQuery, StockQuoteDto>
{
    private readonly IStockService _stockService;
    private readonly ICacheService _cacheService;
    private readonly IEventPublisher _eventPublisher;

    public GetStockQuoteQueryHandler(
        IStockService stockService, 
        ICacheService cacheService, 
        IEventPublisher eventPublisher)
    {
        _stockService = stockService;
        _cacheService = cacheService;
        _eventPublisher = eventPublisher;
    }

    public async Task<StockQuoteDto> Handle(GetStockQuoteQuery request, CancellationToken cancellationToken)
    {
        string ticker = request.Ticker.ToUpper();
        string cacheKey = $"StockQuote_{ticker}";

        // 1. Ищем в Redis
        StockQuoteDto? quoteDto = await _cacheService.GetValueTask<StockQuoteDto>(cacheKey, cancellationToken);
        
        if (quoteDto == null)
        {
            // 2. Если нет в Redis, идем в API
            quoteDto = await _stockService.GetQuoteAsync(ticker, cancellationToken);

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

        await _eventPublisher.PublishAsync(stockEvent, cancellationToken);

        return quoteDto;
    }
}
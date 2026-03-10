using MassTransit;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Infrastructure.Services;

public class RabbitMqEventPublisher : IEventPublisher
{
    private readonly IPublishEndpoint _publishEndpoint;

    public RabbitMqEventPublisher(IPublishEndpoint publishEndpoint)
    {
        _publishEndpoint = publishEndpoint;
    }
    
    public async Task PublishAsync<T>(T @event, CancellationToken cancellationToken = default)
    {
        await _publishEndpoint.Publish(@event!, cancellationToken);
    }
}

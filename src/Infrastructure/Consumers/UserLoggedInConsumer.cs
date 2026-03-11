using MassTransit;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection.Auth.Events;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Notifications.Events;
using ZxcBank.Domain.Entities;

namespace ZxcBank.Infrastructure.Consumers;

public class UserLoggedInConsumer : IConsumer<UserLoggedInEvent>
{
    private readonly IApplicationDbContext _context;
    private readonly IIdentityService _identityService;
    private readonly ILogger<UserLoggedInConsumer> _logger;

    public UserLoggedInConsumer(IApplicationDbContext context, IIdentityService identityService, ILogger<UserLoggedInConsumer> logger)
    {
        _context = context;
        _identityService = identityService;
        _logger = logger;
    }

    public async Task Consume(ConsumeContext<UserLoggedInEvent> context)
    {
        UserLoggedInEvent message = context.Message;

        string? userId = await _identityService.GetUserIdByEmailAsync(message.Email);

        if (userId == null)
        {
            _logger.LogWarning("User not found on UserSession creation: {Email}", message.Email);
            return;
        }
        
        UserSession? lastSession = await _context.UserSessions
            .Where(s => s.UserId == userId)
            .OrderByDescending(s => s.Created)
            .FirstOrDefaultAsync();

        if (lastSession != null)
        {
            bool isSuspicious = lastSession.IpAddress != message.IpAddress ||
                                lastSession.Location != message.Location;

            if (isSuspicious)
            {
                _logger.LogWarning("Suspicious login has been detected!: {Email}", message.Email);

                await context.Publish(new SuspiciousActivityDetectedEvent(
                    UserId: userId,
                    Email: message.Email,
                    NewLocation: message.Location,
                    NewIpAddress: message.IpAddress,
                    OldLocation: lastSession.Location));
            }
        }

        UserSession newSession = new UserSession
        {
            UserId = userId,
            DeviceInfo = message.DeviceInfo,
            IpAddress = message.IpAddress,
            Location = message.Location
        };
        
        _logger.LogInformation("User session has been created for user: {Email}", message.Email);

        _context.UserSessions.Add(newSession);
        
        await _context.SaveChangesAsync(context.CancellationToken);
    }
}

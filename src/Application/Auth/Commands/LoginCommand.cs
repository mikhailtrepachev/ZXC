using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.DependencyInjection.Auth.Events;
using Microsoft.Extensions.Logging;

namespace ZxcBank.Application.Auth.Commands;

public record LoginCommand : IRequest<string>
{
    public required string Email { get; init; }
    public required string Password { get; init; }
    
    public required string DeviceInfo { get; init; }
    public required string IpAddress { get; init; }
    public required string Location { get; init; }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, string>
{
    private readonly IIdentityService _identityService;
    
    private readonly ILogger<LoginCommandHandler> _logger;
    
    private readonly ICacheService _cacheService;
    private readonly IEventPublisher _eventPublisher;

    public LoginCommandHandler(IIdentityService identityService, ILogger<LoginCommandHandler> logger, ICacheService cacheService, IEventPublisher eventPublisher)
    {
        _identityService = identityService;
        _logger = logger;
        _cacheService = cacheService;
        _eventPublisher = eventPublisher;       
    }

    public async Task<string> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        string cacheKey = $"login_attempts_{request.Email}";

        int attempts = await _cacheService.GetValueTask<int>(cacheKey, cancellationToken);

        // 5 attempts to login!
        if (attempts >= 5)
        {
            _logger.LogWarning("Too many attempts to login: {Email}", request.Email);
            throw new UnauthorizedAccessException(
                "Too many failed login attempts. Please wait 5 minutes before trying again.");
        }
        
        string? token = await _identityService.LoginAsync(request.Email, request.Password);

        if (token == null)
        {
            await _cacheService.SetValueTask(cacheKey, attempts + 1, TimeSpan.FromMinutes(5), cancellationToken);
            
            _logger.LogInformation("Login failed: {AttemptedEmail}", request.Email);
            
            throw new UnauthorizedAccessException("Neplatné přihlašovací údaje");
        }

        await _cacheService.RemoveAsync(cacheKey, cancellationToken);

        await _eventPublisher.PublishAsync(
            new UserLoggedInEvent(
                Email: request.Email, 
                TimeStamp: DateTime.UtcNow, 
                IpAddress: request.IpAddress,
                Location: request.Location,
                DeviceInfo: request.DeviceInfo), cancellationToken);
        
        _logger.LogInformation("Login successful: {AttemptedEmail}", request.Email);

        return token;
    }
}

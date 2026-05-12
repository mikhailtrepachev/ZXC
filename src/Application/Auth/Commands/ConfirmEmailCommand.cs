using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Auth.Commands;

public record ConfirmEmailCommand : IRequest<bool>
{
    public required string Email { get; init; }
    public required string Token { get; init; }
}

public class ConfirmEmailCommandHandler : IRequestHandler<ConfirmEmailCommand, bool>
{
    private readonly IIdentityService _identityService;
    private readonly ICacheService _cacheService;
    private readonly ILogger<ConfirmEmailCommandHandler> _logger;

    public ConfirmEmailCommandHandler(IIdentityService identityService, ICacheService cacheService, ILogger<ConfirmEmailCommandHandler> logger)
    {
        _identityService = identityService;
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<bool> Handle(ConfirmEmailCommand request, CancellationToken cancellationToken)
    {
        string cacheKey = $"email_confirm:{request.Email}";

        string? savedToken = await _cacheService.GetValueTask<string>(cacheKey, cancellationToken);

        if (string.IsNullOrEmpty(savedToken) || savedToken != request.Token)
        {
            _logger.LogWarning("Invalid or expired email confirmation token for {Email}", request.Email);

            return false;
        }
        
        bool isConfirmed = await _identityService.ConfirmEmailAsync(request.Email);

        if (!isConfirmed)
        {
            return false;
        }

        await _cacheService.RemoveAsync(cacheKey, cancellationToken);
        
        _logger.LogInformation("Email {Email} successfully confirmed", request.Email);
        
        return true;
    }
}

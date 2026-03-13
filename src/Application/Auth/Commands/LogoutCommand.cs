using System.IdentityModel.Tokens.Jwt;
using Microsoft.Extensions.Logging;
using ZxcBank.Application.Common.Interfaces;

namespace ZxcBank.Application.Auth.Commands;

public record LogoutCommand(string Token) : IRequest<bool>;

public class LogoutCommandHandler : IRequestHandler<LogoutCommand, bool>
{
    private readonly ICacheService _cacheService;
    private readonly ILogger<LogoutCommandHandler> _logger;

    public LogoutCommandHandler(ICacheService cacheService, ILogger<LogoutCommandHandler> logger)
    {
        _cacheService = cacheService;
        _logger = logger;
    }

    public async Task<bool> Handle(LogoutCommand request, CancellationToken cancellationToken)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
            return false;

        try
        {
            JwtSecurityTokenHandler handler = new JwtSecurityTokenHandler();
            JwtSecurityToken? jwtToken = handler.ReadJwtToken(request.Token);

            string? expClaim = jwtToken.Claims.FirstOrDefault(c => c.Type == JwtRegisteredClaimNames.Exp)?.Value;

            if (expClaim != null && long.TryParse(expClaim, out long expSec))
            {
                DateTime expirationTime = DateTimeOffset.FromUnixTimeSeconds(expSec).UtcDateTime;
                
                TimeSpan timeLeft = expirationTime - DateTime.UtcNow;

                if (timeLeft > TimeSpan.Zero)
                {
                    string cacheKey = $"blacklist_{request.Token}";

                    await _cacheService.SetValueTask(
                        cacheKey,
                        true,
                        timeLeft,
                        cancellationToken);
                    
                    _logger.LogInformation("Token has been moved to the blacklist. {TimeLeft} minut)", timeLeft.TotalMinutes);
                }
            }

            return true;
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error while logging out");
            return false;
        }
    }
}

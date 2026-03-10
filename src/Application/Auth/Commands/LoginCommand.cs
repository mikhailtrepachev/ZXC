using ZxcBank.Application.Common.Interfaces;
using MediatR;
using Microsoft.Extensions.Logging;

namespace ZxcBank.Application.Auth.Commands;

public record LoginCommand : IRequest<string>
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, string>
{
    private readonly IIdentityService _identityService;
    
    private readonly ILogger<LoginCommandHandler> _logger;

    public LoginCommandHandler(IIdentityService identityService, ILogger<LoginCommandHandler> logger)
    {
        _identityService = identityService;
        _logger = logger;
    }

    public async Task<string> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        string? token = await _identityService.LoginAsync(request.Email, request.Password);

        if (token == null)
        {
            _logger.LogInformation("Login failed: {AttemptedEmail}", request.Email);
            
            throw new UnauthorizedAccessException("Neplatné přihlašovací údaje");
        }
        
        _logger.LogInformation("Login successful: {AttemptedEmail}", request.Email);

        return token;
    }
}

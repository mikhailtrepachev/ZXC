using ZxcBank.Application.Common.Interfaces;
using MediatR;

namespace ZxcBank.Application.Auth.Commands;

public record LoginCommand : IRequest<string>
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}

public class LoginCommandHandler : IRequestHandler<LoginCommand, string>
{
    private readonly IIdentityService _identityService;

    public LoginCommandHandler(IIdentityService identityService)
    {
        _identityService = identityService;
    }

    public async Task<string> Handle(LoginCommand request, CancellationToken cancellationToken)
    {
        var token = await _identityService.LoginAsync(request.Email, request.Password);

        if (token == null)
        {
            throw new UnauthorizedAccessException("Неверный логин или пароль");
        }

        return token;
    }
}

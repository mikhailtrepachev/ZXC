namespace ZxcBank.Application.Auth.Commands;

public record class LoginRequestDto
{
    public required string Email { get; init; }
    public required string Password { get; init; }
}

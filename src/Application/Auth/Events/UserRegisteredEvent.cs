namespace ZxcBank.Application.Auth.Events;

/// <summary>
/// Event while registration. Used for sending email confirmation link
/// </summary>
public record class UserRegisteredEvent(
    string Email,
    string ConfirmationLink
);

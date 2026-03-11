using ZxcBank.Application.Common.Models;

namespace ZxcBank.Application.Common.Interfaces;

public interface IIdentityService
{
    Task<string?> GetUserNameAsync(string userId);

    Task<bool> IsInRoleAsync(string userId, string role);

    Task<bool> AuthorizeAsync(string userId, string policyName);

    Task<(Result Result, string UserId)> CreateUserAsync(string userName, string password);

    Task<Result> DeleteUserAsync(string userId);
    
    Task<Result> AddToRoleAsync(string userId, string role);

    Task<string?> LoginAsync(string email, string password);
    
    Task<string?> GetUserIdByEmailAsync(string email);
}

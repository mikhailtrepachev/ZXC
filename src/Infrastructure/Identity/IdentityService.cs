using System.Security.Claims;
using ZxcBank.Application.Common.Interfaces;
using ZxcBank.Application.Common.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using ZxcBank.Infrastructure.Authentication;

namespace ZxcBank.Infrastructure.Identity;

public class IdentityService : IIdentityService
{
    private readonly UserManager<ApplicationUser> _userManager;
    private readonly IUserClaimsPrincipalFactory<ApplicationUser> _userClaimsPrincipalFactory;
    private readonly IAuthorizationService _authorizationService;
    private readonly JwtTokenGenerator _tokenGenerator;

    public IdentityService(
        UserManager<ApplicationUser> userManager,
        IUserClaimsPrincipalFactory<ApplicationUser> userClaimsPrincipalFactory,
        IAuthorizationService authorizationService,
        JwtTokenGenerator tokenGenerator)
    {
        _userManager = userManager;
        _userClaimsPrincipalFactory = userClaimsPrincipalFactory;
        _authorizationService = authorizationService;
        _tokenGenerator = tokenGenerator;
    }

    public async Task<string?> GetUserNameAsync(string userId)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId);

        return user?.UserName;
    }

    public async Task<(Result Result, string UserId)> CreateUserAsync(string userName, string password)
    {
        ApplicationUser user = new ApplicationUser
        {
            UserName = userName,
            Email = userName,
            NormalizedEmail = userName.ToUpperInvariant(),
        };

        IdentityResult result = await _userManager.CreateAsync(user, password);

        return (result.ToApplicationResult(), user.Id);
    }

    public async Task<bool> IsInRoleAsync(string userId, string role)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId);

        return user != null && await _userManager.IsInRoleAsync(user, role);
    }

    public async Task<bool> AuthorizeAsync(string userId, string policyName)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId);

        if (user == null)
        {
            return false;
        }

        ClaimsPrincipal principal = await _userClaimsPrincipalFactory.CreateAsync(user);

        AuthorizationResult result = await _authorizationService.AuthorizeAsync(principal, policyName);

        return result.Succeeded;
    }

    public async Task<Result> DeleteUserAsync(string userId)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId);

        return user != null ? await DeleteUserAsync(user) : Result.Success();
    }

    public async Task<Result> DeleteUserAsync(ApplicationUser user)
    {
        IdentityResult result = await _userManager.DeleteAsync(user);

        return result.ToApplicationResult();
    }
    
    public async Task<Result> AddToRoleAsync(string userId, string role)
    {
        ApplicationUser? user = await _userManager.FindByIdAsync(userId);
    
        // Если не нашли - ошибка
        if (user == null)
        {
            return Result.Failure(new[] { "User not found" });
        }

        // 2. Добавляем роль через UserManager (стандартный класс .NET Identity)
        IdentityResult result = await _userManager.AddToRoleAsync(user, role);

        // 3. Преобразуем результат в формат вашего приложения
        return result.ToApplicationResult();
    }
    
    public async Task<string?> LoginAsync(string email, string password)
    {
        ApplicationUser? user = await _userManager.FindByEmailAsync(email);
        if (user == null) return null;

        bool result = await _userManager.CheckPasswordAsync(user, password);
        if (!result) return null;

        // Генерируем JWT с ролями!
        return await _tokenGenerator.GenerateTokenAsync(user);
    }

    public async Task<string?> GetUserIdByEmailAsync(string email)
    {
        ApplicationUser? user = await _userManager.FindByEmailAsync(email);

        return user?.Id;
    }
}

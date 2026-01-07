<#
创建并推送 git 分支（PowerShell）
用法：
  1) 在项目根目录执行： .\scripts\create_branch.ps1 -BranchName "copilot-version"
  2) 或指定其他分支名： .\scripts\create_branch.ps1 -BranchName "your-branch-name"

说明：
 - 本脚本只在本机已安装 git 且已配置好凭证时才会成功运行。
 - **建议分支名不要包含空格，推荐使用连字符（-）或下划线（_），脚本默认分支为 `copilot-version`。**
#>
param(
    [Parameter(Mandatory=$false)]
    [string]$BranchName = "copilot-version"
)

Set-Location -Path (Split-Path -Path $MyInvocation.MyCommand.Definition -Parent) | Out-Null
Set-Location ..

Write-Output "当前路径: $(Get-Location)"

try {
    git --version | Out-Null
} catch {
    Write-Error "未检测到 git。请先安装 git（https://git-scm.com/ 或 使用 winget/choco 安装），然后再运行本脚本。"
    exit 1
}

# 确保是 git 仓库
if (-not (Test-Path ".git")) {
    Write-Output "未检测到 .git：正在初始化仓库..."
    git init
}

# 创建并切换分支
Write-Output "创建并切换到分支：'$BranchName'"
git checkout -b -- "$BranchName"

# 将工作区全部变更加入并提交（如果有变更）
git add -A
$changes = git status --porcelain
if ($changes) {
    git commit -m "chore: create branch $BranchName"
} else {
    Write-Output "无需提交（工作区无变更）。"
}

# 添加远程 origin（如果已存在则忽略）
$origin = git remote get-url origin 2>$null
if (-not $origin) {
    Write-Output "检测不到远程 origin，请手动添加 remote（例如：git remote add origin https://github.com/you/repo.git）并随后运行：git push -u origin \"$BranchName\""
} else {
    Write-Output "推送分支到远程 origin：$origin"
    git push -u origin -- "$BranchName"
}

Write-Output "完成。当前分支："
git branch --show-current

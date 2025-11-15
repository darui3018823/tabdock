# Contributing to Tabdock

Thank you for considering contributing to Tabdock! Your contributions help make this project better for everyone.

This document outlines guidelines for contributing to Tabdock, including how to report bugs, suggest features, and submit code changes.

## Code of Conduct

Please note that this project is released with a [Contributor Code of Conduct](CODE_OF_CONDUCT.md). By participating in this project, you agree to abide by its terms.

## How Can I Contribute?

### Reporting Bugs

If you find a bug, please open an issue on GitHub. Before opening a new issue, please check if a similar issue already exists. When reporting a bug, please include:

*   A clear and concise description of the bug.
*   Steps to reproduce the behavior.
*   Expected behavior.
*   Screenshots or error messages, if applicable.
*   Your operating system and browser version.
> If the reproduction steps are unclear, please provide as much information as possible.

### Suggesting Enhancements

We welcome suggestions for new features or improvements to existing ones. Please open an issue on GitHub and describe your idea.

### Code Contributions

We appreciate code contributions! Please follow these steps to contribute:

1.  **Fork the Repository:** Start by forking the Tabdock repository to your GitHub account.
2.  **Clone Your Fork:** Clone your forked repository to your local machine.
    ```bash
    git clone https://github.com/YOUR_USERNAME/tabdock.git
    cd tabdock
    ```
3.  **Set Up Your Development Environment:**
    *   **Go:** Ensure you have Go (version 1.24.0 or newer) installed.
    *   **Dependencies:** Install Go modules.
        ```bash
        go mod tidy
        ```
    *   **Build and Run:** Building and running the project is primarily done using the provided PowerShell scripts.
        ```bash
        # Windows
        pwsh.exe ./ps/amd64_win_autorun.ps1

        # macOS
        pwsh ./ps/arm64_mac_autorun.ps1

        # Linux
        pwsh ./ps/amd64_linux_autorun.ps1
        ```
        If PowerShell is not available, please use your OS's standard shell with `go build` or `go run`.
        (Note: `cert/tabdock.crt` and `cert/tabdock.key` are required for startup. If they are not present, you need to run in Docker mode.)
4.  **Create a New Branch:** Create a new branch for your feature or bug fix.
    ```bash
    git checkout -b feature/your-feature-name
    # or
    git checkout -b bugfix/your-bug-fix-name
    ```
5.  **Make Your Changes:** Implement your changes, ensuring they adhere to the existing code style.
    *   **Go Formatting:** Use `gofmt` to format your Go code.
        ```bash
        gofmt -w .
        ```
    *   **Linting:** Consider running `golint` (if installed) or `staticcheck` for static analysis.
    *   **Testing:** Write unit tests for new features or bug fixes.
        ```bash
        go test ./...
        ```
6.  **Commit Your Changes:** Write clear and concise commit messages. We follow a convention similar to Conventional Commits.
    *   Start with a type (e.g., `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`).
    *   Follow with a scope (optional) and a brief description.
    *   Example: `fix: Correct PWA icon path in manifest.json`
7.  **Push Your Branch:** Push your changes to your forked repository.
    ```bash
    git push origin feature/your-feature-name
    ```
8.  **Create a Pull Request:** Create a pull request from your branch to the `main` branch of the original Tabdock repository.
    *   Provide a clear title and description of your changes.
    *   Reference any related issues.
    *   Using AI assistants like `chatgpt-codex-connector` or `gemini-code-assist` to help with PR reviews is also welcome.

### Documentation Contributions

Improvements to documentation are always welcome! This includes READMEs, comments in code, or any other explanatory text.

## Questions?

If you have any questions, feel free to open an issue on GitHub or reach out to the maintainers.

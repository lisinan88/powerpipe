package cmd

import (
	"context"
	"fmt"
	"os"

	"github.com/mattn/go-isatty"
	"github.com/spf13/cobra"
	"github.com/spf13/viper"
	"github.com/turbot/pipe-fittings/constants"
	"github.com/turbot/pipe-fittings/statushooks"
	"github.com/turbot/pipe-fittings/utils"
	"github.com/turbot/powerpipe/internal/version"
	"github.com/turbot/powerpipe/pkg/filepaths"
	"github.com/turbot/steampipe/pkg/error_helpers"
)

// rootCmd represents the base command when called without any subcommands
var rootCmd = &cobra.Command{
	Use:     "powerpipe [--version] [--help] COMMAND [args]",
	Version: "0.0.1",
	Short:   "Powerpipe",
}

var exitCode int

func InitCmd() {
	utils.LogTime("cmd.root.InitCmd start")
	defer utils.LogTime("cmd.root.InitCmd end")

	rootCmd.SetVersionTemplate(fmt.Sprintf("Powerpipe v%s\n", version.PowerpipeVersion.String()))

	rootCmd.PersistentFlags().String("install-dir", filepaths.DefaultInstallDir, "Path to the installation directory")
	error_helpers.FailOnError(viper.BindPFlag("install-dir", rootCmd.PersistentFlags().Lookup(constants.ArgInstallDir)))

	AddCommands()
	// disable auto completion generation, since we don't want to support
	// powershell yet - and there's no way to disable powershell in the default generator
	rootCmd.CompletionOptions.DisableDefaultCmd = true
}

func AddCommands() {
	rootCmd.AddCommand(
		modCmd(),
		serviceCmd(),
	)
}

func Execute() int {
	utils.LogTime("cmd.root.Execute start")
	defer utils.LogTime("cmd.root.Execute end")

	ctx := createRootContext()

	rootCmd.ExecuteContext(ctx)
	return exitCode
}

// create the root context - add a status renderer
func createRootContext() context.Context {
	statusRenderer := statushooks.NullHooks
	// if the client is a TTY, inject a status spinner
	if isatty.IsTerminal(os.Stdout.Fd()) {
		statusRenderer = statushooks.NewStatusSpinnerHook()
	}

	ctx := statushooks.AddStatusHooksToContext(context.Background(), statusRenderer)
	return ctx
}

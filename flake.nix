{
  description = "ANTS LES02 development environment";

  inputs = {
    nixpkgs.url = "github:NixOS/nixpkgs/nixos-25.11";
  };

  outputs =
    { self, nixpkgs }:
    let
      system = "x86_64-linux";
      pkgs = import nixpkgs { inherit system; };
      python = pkgs.python314;
      pythonPackages = pkgs.python314Packages;
    in
    {
      devShells.${system}.default = pkgs.mkShell {
        name = "les02-dev";

        packages = with pkgs; [
          # Python
          python
          pythonPackages.python-can
          pythonPackages.numpy
          pythonPackages.matplotlib
          pythonPackages.pandas
          pythonPackages.fastapi
          pythonPackages.uvicorn
          pythonPackages.websockets

          # CAN tooling
          can-utils

          # Web UI
          bun
          nodejs
          nodePackages.tailwindcss
          nodePackages.postcss
          nodePackages.autoprefixer

          # Devtools
          git
        ];

        shellHook = ''
          echo "🚦 LES02 dev shell ready (flake)"
          echo "Python: $(python --version)"
          echo "Node: $(node --version)"
          echo "Bun: $(bun --version)"

          echo "CAN interfaces:"
          ip link show vcan0 2>/dev/null || echo "  ⚠️ vcan0 not found"

          alias candump0='candump vcan0'
          alias candump0t='candump -t a vcan0'
          alias candump0td='candump -t d vcan0'

          alias leslisten='python -m listener.main'
          alias lesmock='python -m mock.mock_les02'
          alias lesdebug='python -m listener.debug_ws_client'

          echo "Aliases:"
          echo "  candump0   -> candump vcan0"
          echo "  candump0t  -> candump -t a vcan0"
          echo "  candump0td -> candump -t d vcan0"
          echo "  leslisten  -> python -m listener.main"
          echo "  lesmock    -> python -m mock.mock_les02"
          echo "  lesdebug   -> python -m listener.debug_ws_client"
        '';
      };
    };
}

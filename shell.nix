{
  pkgs ? import <nixpkgs> { },
  pythonPackages ? pkgs.python312Packages,
}:

pkgs.mkShell {

  name = "les02-dev";

  packages = with pkgs; [
    # Python
    pythonPackages.python
    pythonPackages.python-can
    pythonPackages.numpy
    pythonPackages.matplotlib
    pythonPackages.pandas
    pythonPackages.fastapi
    pythonPackages.uvicorn
    pythonPackages.websockets

    # CAN tooling
    can-utils

    # Nice-to-have
    git
  ];

  shellHook = ''
    echo "🚦 LES02 dev shell ready"
    echo "Python: $(python --version)"
    echo "CAN interfaces:"
    ip link show vcan0 2>/dev/null || echo "  ⚠️ vcan0 not found"
    alias candump0='candump vcan0'
    alias candump0t='candump -t a vcan0'
    alias candump0td='candump -t d vcan0'

    alias leslisten='python -m listener.main'
    alias lesmock='python -m mock.mock_les02'

    echo "Aliases:"
    echo "  candump0   -> candump vcan0"
    echo "  candump0t  -> candump -t a vcan0"
    echo "  candump0td -> candump -t d vcan0"
  '';
}

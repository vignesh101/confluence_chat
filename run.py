#!/usr/bin/env python3
"""
Development server runner for Confluence Chat.
Runs both the FastAPI backend and React development server.
"""
import subprocess
import sys
import os
from pathlib import Path

def main():
    # Check if we're in the right directory
    if not Path("api.py").exists():
        print("Error: Please run this script from the project root directory")
        sys.exit(1)

    # Check if frontend dependencies are installed
    node_modules = Path("frontend/node_modules")
    if not node_modules.exists():
        print("Installing frontend dependencies...")
        subprocess.run(
            ["npm", "install"],
            cwd="frontend",
            check=True
        )

    print("\n" + "=" * 50)
    print("Starting Confluence Chat")
    print("=" * 50)
    print("\nBackend API: http://localhost:8000")
    print("Frontend:    http://localhost:3000")
    print("\nPress Ctrl+C to stop both servers\n")

    # Start backend
    backend_process = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "api:app", "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=os.getcwd()
    )

    # Start frontend
    frontend_process = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd="frontend"
    )

    try:
        backend_process.wait()
        frontend_process.wait()
    except KeyboardInterrupt:
        print("\nShutting down...")
        backend_process.terminate()
        frontend_process.terminate()
        backend_process.wait()
        frontend_process.wait()
        print("Done!")

if __name__ == "__main__":
    main()

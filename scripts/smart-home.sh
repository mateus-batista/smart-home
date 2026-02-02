#!/bin/zsh

# Smart Home Service Manager
# Usage: ./scripts/smart-home.sh [start|stop|restart|status|logs]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Get the directory where this script is located
SCRIPT_DIR="${0:A:h}"
PROJECT_DIR="${SCRIPT_DIR:h}"

# PID files location
PID_DIR="$PROJECT_DIR/.pids"
mkdir -p "$PID_DIR"

# Log files location
LOG_DIR="$PROJECT_DIR/.logs"
mkdir -p "$LOG_DIR"

# Service definitions using associative arrays
typeset -A SERVICE_DIRS
SERVICE_DIRS=(
    server "$PROJECT_DIR/server"
    voice-assistant "$PROJECT_DIR/voice-assistant"
    web-app "$PROJECT_DIR/web-app"
    proxy "$PROJECT_DIR/proxy"
)

typeset -A SERVICE_COMMANDS
SERVICE_COMMANDS=(
    server "npm run dev"
    voice-assistant "uv run belle"
    web-app "npm run dev"
    proxy "PROXY_PORT=8443 npm start"
)

typeset -A SERVICE_PORTS
SERVICE_PORTS=(
    server "3001"
    voice-assistant "3002"
    web-app "5173"
    proxy "8443"
)

# Service order
SERVICES_START=(server voice-assistant web-app proxy)
SERVICES_STOP=(proxy web-app voice-assistant server)

# Print colored message
print_status() {
    local color=$1
    local message=$2
    echo -e "${color}${message}${NC}"
}

# Check if a service is running
is_running() {
    local service=$1
    local pid_file="$PID_DIR/$service.pid"
    
    if [[ -f "$pid_file" ]]; then
        local pid=$(cat "$pid_file")
        if kill -0 "$pid" 2>/dev/null; then
            return 0
        fi
    fi
    return 1
}

# Start a service
start_service() {
    local service=$1
    local dir="${SERVICE_DIRS[$service]}"
    local cmd="${SERVICE_COMMANDS[$service]}"
    local port="${SERVICE_PORTS[$service]}"
    local pid_file="$PID_DIR/$service.pid"
    local log_file="$LOG_DIR/$service.log"
    
    if is_running "$service"; then
        print_status "$YELLOW" "  ⚠️  $service is already running (PID: $(cat $pid_file))"
        return 0
    fi
    
    if [[ ! -d "$dir" ]]; then
        print_status "$RED" "  ❌ $service directory not found: $dir"
        return 1
    fi
    
    print_status "$BLUE" "  🚀 Starting $service..."
    
    # Start the service in the background
    cd "$dir"
    nohup zsh -c "$cmd" > "$log_file" 2>&1 &
    local pid=$!
    echo $pid > "$pid_file"
    
    # Wait a moment and check if it started
    sleep 2
    if kill -0 "$pid" 2>/dev/null; then
        print_status "$GREEN" "  ✅ $service started (PID: $pid, Port: $port)"
    else
        print_status "$RED" "  ❌ $service failed to start. Check logs: $log_file"
        rm -f "$pid_file"
        return 1
    fi
}

# Stop a service
stop_service() {
    local service=$1
    local pid_file="$PID_DIR/$service.pid"
    
    if ! is_running "$service"; then
        print_status "$YELLOW" "  ⚠️  $service is not running"
        rm -f "$pid_file"
        return 0
    fi
    
    local pid=$(cat "$pid_file")
    print_status "$BLUE" "  🛑 Stopping $service (PID: $pid)..."
    
    # Try graceful shutdown first
    kill "$pid" 2>/dev/null || true
    
    # Wait for process to stop
    local count=0
    while kill -0 "$pid" 2>/dev/null && [[ $count -lt 10 ]]; do
        sleep 0.5
        count=$((count + 1))
    done
    
    # Force kill if still running
    if kill -0 "$pid" 2>/dev/null; then
        kill -9 "$pid" 2>/dev/null || true
        sleep 1
    fi
    
    rm -f "$pid_file"
    print_status "$GREEN" "  ✅ $service stopped"
}

# Show service status
show_status() {
    local service=$1
    local port="${SERVICE_PORTS[$service]}"
    local pid_file="$PID_DIR/$service.pid"
    
    if is_running "$service"; then
        local pid=$(cat "$pid_file")
        print_status "$GREEN" "  ✅ $service: running (PID: $pid, Port: $port)"
    else
        print_status "$RED" "  ❌ $service: stopped"
    fi
}

# Show logs for a service
show_logs() {
    local service=$1
    local log_file="$LOG_DIR/$service.log"
    
    if [[ -f "$log_file" ]]; then
        echo ""
        print_status "$BLUE" "📋 Logs for $service:"
        echo "─────────────────────────────────────────"
        tail -50 "$log_file"
        echo "─────────────────────────────────────────"
    else
        print_status "$YELLOW" "  ⚠️  No logs found for $service"
    fi
}

# Follow logs for all services
follow_logs() {
    print_status "$BLUE" "📋 Following logs (Ctrl+C to stop)..."
    tail -f "$LOG_DIR"/*.log
}

# Main command handler
case "${1:-}" in
    start)
        echo ""
        print_status "$BLUE" "🏠 Starting Smart Home Services..."
        echo "═════════════════════════════════════════"
        
        for service in $SERVICES_START; do
            start_service "$service"
        done
        
        echo ""
        print_status "$GREEN" "🎉 All services started!"
        echo ""
        print_status "$BLUE" "Access your Smart Home:"
        print_status "$NC" "  Local:  https://localhost:8443"
        print_status "$NC" "  Mobile: https://192.168.5.17:8443"
        echo ""
        ;;
        
    stop)
        echo ""
        print_status "$BLUE" "🏠 Stopping Smart Home Services..."
        echo "═════════════════════════════════════════"
        
        for service in $SERVICES_STOP; do
            stop_service "$service"
        done
        
        echo ""
        print_status "$GREEN" "✅ All services stopped"
        echo ""
        ;;
        
    restart)
        echo ""
        print_status "$BLUE" "🔄 Restarting Smart Home Services..."
        echo "═════════════════════════════════════════"
        
        for service in $SERVICES_STOP; do
            stop_service "$service"
        done
        
        sleep 2
        
        for service in $SERVICES_START; do
            start_service "$service"
        done
        
        echo ""
        print_status "$GREEN" "🎉 All services restarted!"
        echo ""
        ;;
        
    status)
        echo ""
        print_status "$BLUE" "🏠 Smart Home Service Status"
        echo "═════════════════════════════════════════"
        
        for service in $SERVICES_START; do
            show_status "$service"
        done
        echo ""
        ;;
        
    logs)
        if [[ -n "${2:-}" ]]; then
            show_logs "$2"
        else
            follow_logs
        fi
        ;;
        
    *)
        echo ""
        print_status "$BLUE" "🏠 Smart Home Service Manager"
        echo "═════════════════════════════════════════"
        echo ""
        echo "Usage: $0 <command> [service]"
        echo ""
        echo "Commands:"
        echo "  start    Start all services"
        echo "  stop     Stop all services"
        echo "  restart  Restart all services"
        echo "  status   Show service status"
        echo "  logs     Follow all logs, or 'logs <service>' for specific service"
        echo ""
        echo "Services: server, voice-assistant, web-app, proxy"
        echo ""
        echo "Examples:"
        echo "  $0 start           # Start all services"
        echo "  $0 stop            # Stop all services"
        echo "  $0 status          # Check status"
        echo "  $0 logs            # Follow all logs"
        echo "  $0 logs server     # Show server logs"
        echo ""
        ;;
esac

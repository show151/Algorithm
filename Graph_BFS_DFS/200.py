class Solution(object):
    def numIslands(self, grid):
        
        if not grid:
            return 0
        
        rows, cols = len(grid), len(grid[0])
        count = 0
        directions = [(1,0), (-1,0), (0,1), (0,-1)]

        for r in range(rows):
            for c in range(cols):
                if grid[r][c] == "1":
                    count += 1
                    
                    # Flood fill one island and mark it as visited.
                    stack = [(r, c)]
                    grid[r][c] = "0"
                    
                    while stack:
                        x, y = stack.pop()
                        
                        for dx, dy in directions:
                            nx, ny = x + dx, y + dy
                            
                            if 0 <= nx < rows and 0 <= ny < cols and grid[nx][ny] == "1":
                                grid[nx][ny] = "0"
                                stack.append((nx, ny))
        
        return count
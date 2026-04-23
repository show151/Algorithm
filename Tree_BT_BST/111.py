import collections
class Solution(object):
    def minDepth(self, root):
        
        if not root:
            return 0

        queue = collections.deque([root])
        depth = 1

        while queue:
            level_size = len(queue)

            for _ in range(level_size):
                node = queue.popleft()

                if not node.left and not node.right:
                    return depth

                if node.left:
                    queue.append(node.left)
                if node.right:
                    queue.append(node.right)

            depth += 1

        return depth
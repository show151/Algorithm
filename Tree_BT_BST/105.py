import collections  # cspell:ignore inorder preorder

class TreeNode(object):
    def __init__(self, val=0, left=None, right=None):
        self.val = val
        self.left = left
        self.right = right

class Solution(object):
    def buildTree(self, preorder, inorder):
        
        if not preorder or not inorder:
            return None

        index_map = {value: idx for idx, value in enumerate(inorder)}
        preorder_q = collections.deque(preorder)

        def build(left, right):
            if left > right:
                return None

            root_val = preorder_q.popleft()
            root = TreeNode(root_val)
            mid = index_map[root_val]

            root.left = build(left, mid - 1)
            root.right = build(mid + 1, right)
            return root

        return build(0, len(inorder) - 1)
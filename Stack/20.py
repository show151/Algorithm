class Solution(object):
    def isValid(self, s):
        pair = {"(": ")", "[": "]", "{": "}"}
        stack = []

        for ch in s:
            if ch in pair:
                stack.append(ch)
            else:
                if not stack or ch != pair[stack.pop()]:
                    return False

        return len(stack) == 0

class Solution(object):
    def subarraySum(self, nums, k):
        prefix_count = {0: 1}
        total = 0
        count = 0

        for n in nums:
            total += n
            count += prefix_count.get(total - k, 0)
            prefix_count[total] = prefix_count.get(total, 0) + 1

        return count
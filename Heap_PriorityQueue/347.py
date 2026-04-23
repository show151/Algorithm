class Solution(object):
    def topKFrequent(self, nums, k):
        n = len(nums)
        occur = {}

        for num in nums:
            occur[num] = occur.get(num, 0) + 1

        bucket = [[] for _ in range(n + 1)]
        for key in occur:
            bucket[occur[key]].append(key)

        res = []
        for i in range(n, 0, -1):
            for val in bucket[i]:
                res.append(val)
                if len(res) == k:
                    return res
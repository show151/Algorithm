class Solution(object):
    def numUniqueEmails(self, emails):
        unique_email = set()

        for email in emails:
            local, domain = email.split("@")
            plus_index = local.find("+")
            if plus_index != -1:
                local = local[:plus_index]
            local = local.replace(".", "")
            unique_email.add(local + "@" + domain)

        return len(unique_email)
import hashlib
import pickle


class Widget:
    def load(self, data):
        return pickle.loads(data)


def outer(data):
    def inner(data):
        return pickle.loads(data)
    return inner


def digest(data):
    return hashlib.md5(data).hexdigest()


def dup(data):
    return pickle.loads(data)


def dup(data):
    return pickle.loads(data)

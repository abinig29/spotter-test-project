from abc import ABC, abstractmethod


class ReverseGeocoder(ABC):
    @abstractmethod
    def reverse(self, lat: float, lng: float) -> str:
        """Return a human-readable 'City, ST' name. Must never raise."""

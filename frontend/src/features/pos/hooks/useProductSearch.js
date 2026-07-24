import { useEffect, useState } from "react";

import { searchPosProducts } from "../api/productsApi";
import { getPosErrorMessage } from "../utils/posErrors";

export function useProductSearch({ branchId, searchTerm }) {
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!branchId) {
      setResults([]);
      setIsLoading(false);
      setError(null);
      return undefined;
    }

    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setIsLoading(true);
      setError(null);

      try {
        const products = await searchPosProducts({
          branchId,
          q: searchTerm,
          pageSize: 10,
        });

        if (!controller.signal.aborted) {
          const inStockProducts = products.filter(
            (product) => product.stock > 0,
          );
          setResults(inStockProducts);
        }
      } catch (requestError) {
        if (!controller.signal.aborted) {
          setResults([]);
          setError(getPosErrorMessage(requestError));
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }, 250);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [branchId, searchTerm]);

  return {
    error,
    isLoading,
    results,
  };
}

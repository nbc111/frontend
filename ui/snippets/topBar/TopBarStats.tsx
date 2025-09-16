import { Flex, chakra } from '@chakra-ui/react';
import React from 'react';

import config from 'configs/app';
import useApiQuery, { useExternalApiQuery } from 'lib/api/useApiQuery';
import dayjs from 'lib/date/dayjs';
import useIsMobile from 'lib/hooks/useIsMobile';
import { HOMEPAGE_STATS } from 'stubs/stats';
import { Link } from 'toolkit/chakra/link';
import { Skeleton } from 'toolkit/chakra/skeleton';
import GasInfoTooltip from 'ui/shared/gas/GasInfoTooltip';
import GasPrice from 'ui/shared/gas/GasPrice';
import TextSeparator from 'ui/shared/TextSeparator';

import GetGasButton from './GetGasButton';

interface TickerApiResponse {
  status: string;
  message: string | null;
  data: {
    tradeName: string;
    buy: number;
    sell: number;
    high: number;
    low: number;
    last: number;
    open: number;
    chg: number;
    vol24hour: number;
  };
}
const TopBarStats = () => {
  const isMobile = useIsMobile();


  const { data: newData, isLoading, isError: isNewError } = useExternalApiQuery<TickerApiResponse>(
    '/api/proxy/ticker?symbol=nbcusdt&accessKey=3PswIE0Z9w26R9MC5XrGU8b6LD4bQIWWO1x3nwix1xI='
  );
  
  const { data, isPlaceholderData, isError, refetch, dataUpdatedAt } = useApiQuery('general:stats', {
    queryOptions: {
      placeholderData: HOMEPAGE_STATS,
      refetchOnMount: false,
    },
  });

  React.useEffect(() => {
    if (isPlaceholderData || !data?.gas_price_updated_at) {
      return;
    }

    const endDate = dayjs(dataUpdatedAt).add(data.gas_prices_update_in, 'ms');
    const timeout = endDate.diff(dayjs(), 'ms');

    if (timeout <= 0) {
      return;
    }

    const timeoutId = window.setTimeout(() => {
      refetch();
    }, timeout);

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [ isPlaceholderData, data?.gas_price_updated_at, dataUpdatedAt, data?.gas_prices_update_in, refetch ]);

  if (isError) {
    return <div/>;
  }

  return (
    <Flex
      alignItems="center"
      fontSize="xs"
      fontWeight={ 500 }
    >
      { data?.coin_price && (
        <Flex columnGap={ 1 }>
          <Skeleton loading={ isPlaceholderData }>
            <chakra.span color="text.secondary">{ config.chain.currency.symbol } </chakra.span>
            <span>${ newData?.data?.buy }</span>
          </Skeleton>
          { data.coin_price_change_percentage && (
            <Skeleton loading={ isPlaceholderData }>
              <chakra.span color={ Number(data.coin_price_change_percentage) >= 0 ? 'green.500' : 'red.500' }>
                { Number(newData?.data?.chg).toFixed(2) }%
              </chakra.span>
            </Skeleton>
          ) }
        </Flex>
      ) }
      { !isMobile && data?.secondary_coin_price && config.chain.secondaryCoin.symbol && (
        <Flex columnGap={ 1 } ml={ data?.coin_price ? 3 : 0 }>
          <Skeleton loading={ isPlaceholderData }>
            <chakra.span color="text.secondary">{ config.chain.secondaryCoin.symbol } </chakra.span>
            <span>${ Number(data.secondary_coin_price).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 6 }) }</span>
          </Skeleton>
        </Flex>
      ) }
      { data?.coin_price && config.features.gasTracker.isEnabled && <TextSeparator color="border.divider"/> }
      { data?.gas_prices && data.gas_prices.average !== null && config.features.gasTracker.isEnabled && (
        <>
          <Skeleton loading={ isPlaceholderData } display="inline-flex" whiteSpace="pre-wrap">
            <chakra.span color="text.secondary">Gas </chakra.span>
            <GasInfoTooltip data={ data } dataUpdatedAt={ dataUpdatedAt } placement={ !data?.coin_price ? 'bottom-start' : undefined }>
              <Link>
                <GasPrice data={ data.gas_prices.average }/>
              </Link>
            </GasInfoTooltip>
          </Skeleton>
          { !isPlaceholderData && <GetGasButton/> }
        </>
      ) }
      { data?.gas_prices && data.gas_prices.average !== null && config.features.gasTracker.isEnabled && (
        <>
          <TextSeparator color="border.divider"/>
          <Link href="https://nbcoin.top/" target="_blank" rel="noopener noreferrer" color="text.secondary" _hover={{ color: 'text.primary' }}>
            链官网
          </Link>
          <TextSeparator color="border.divider"/>
          <Link href="https://download.zkbwallets.xyz/" target="_blank" rel="noopener noreferrer" color="text.secondary" _hover={{ color: 'text.primary' }}>
            钱包宣导页
          </Link>
        </>
      ) }
    </Flex>
  );
};

export default React.memo(TopBarStats);

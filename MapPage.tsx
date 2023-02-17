import React, {useState, FC, useEffect, Fragment, useMemo } from 'react';
import { Map as LeafletMap, TileLayer, Popup, CircleMarker } from 'react-leaflet';
import FullscreenControl from 'react-leaflet-fullscreen';
import { connect } from 'react-redux';
import classNames from 'classnames';
import * as L from 'leaflet';
import { t } from 'i18next';

import { Devices, GuardedObject, GeneralTape, ChessStatus, GuardedObjects, ChessOrMapFilter, Dispatch, DevicesTypes, STORE, StatusInChess, TypeDevice } from '../../../_types';
import { getObjStatus, legendElements, WHITE } from '../../../_helpers';
import { filterActions } from '../../../_actions';
import { OperatorPanelLegend } from '../ChessModePage/OperatorPanelLegend';
import Spinner from '../../CommonComponents/Spinner';

const CURRENT_MAP_ZOOM = 11;
const INCREASED_ZOOM = 14;
const START_MAP_CENTER = { lat: 50.4, lng: 30.64 };
const MARKER_RADIUS = 8;
const MARKER_WEIGHT = 2;
const MARKER_FILL_OPACITY = 0.9;
const STATUS_OK = 'ok';

export type MapGuardedObject = GuardedObject & { type?: string, statusInChess?: ChessStatus };

type Props = {
    showRightTab: boolean;
};

type PropsFromRedux = {
    guardedObjects: GuardedObjects,
    devices: Devices,
    generalTape: GeneralTape[],
    showLoader: boolean;
    mapFilter: ChessOrMapFilter;
    dispatch: Dispatch,
};

const MapModePage: FC<Props & PropsFromRedux> = ({
    showRightTab,
    guardedObjects,
    devices,
    generalTape,
    showLoader,
    mapFilter,
    dispatch,
}) => {
    const [currentZoom, setCurrentZoom] = useState(CURRENT_MAP_ZOOM);
    const [center, setCenter] = useState(START_MAP_CENTER);
    const { number, status, type } = mapFilter;
    
    const addClassesStatusAndType = useMemo(() => {
        const objects: MapGuardedObject[] = [];
        
        Object.values(guardedObjects).forEach((guardedObject: GuardedObject) => {
            if (!guardedObject.device_number)
                objects.push({ ...guardedObject, statusInChess: StatusInChess.OBJECT_WITHOUT_DEVICE, type: TypeDevice.NO_TYPE });
            else {
                const { obj_id, device_blocked, device_id } = guardedObject;
                const objectInGeneralTape = generalTape[obj_id];
                const currentDevice = device_id && devices[device_id];
                if (!currentDevice) return;
                const statusInChess = getObjStatus(currentDevice, objectInGeneralTape, device_blocked) as ChessStatus;
                const typeDevice = currentDevice.type as string;
    
                objects.push({ ...guardedObject, statusInChess, type: typeDevice });
            }
        });
        
        return objects;
        
    }, [guardedObjects]);

    const isCoordinateCorrectly = (object: MapGuardedObject) => {
        if (object.lat === '' || object.long === '') return false;

        const lat = Number(object.lat);
        const long = Number(object.long);

        if (Number.isNaN(lat) || Number.isNaN(long)) return false;
        if (lat >= 90 || lat <= -90 || long >= 180 || long <= -180) return false;
        
        return true;
    };

    const getMarkerColor = (object: MapGuardedObject) => {
        const status = object.statusInChess;
        return legendElements.find(legendElement => legendElement.extraClass === status).color;
    };
    
    const filteredObjects = useMemo(() => {
        let result = addClassesStatusAndType(guardedObjects);
        
        if (status.length) {
            result = result.filter(guardedObject => status.includes(guardedObject.statusInChess));
        }
        
        if (Object.values(type).flat().length) {
            result = result.filter(guardedObject => Object.values(type).flat().includes(guardedObject.type));
        }
        
        if (number !== null) {
            result = result.filter(guardedObject => guardedObject.device_number === Number(number));
        }

        return result;
    }, [mapFilter, guardedObjects, generalTape, devices]);
    
    const deviceNumberTooltip = useMemo(() => {
        const isObjectExist = Object.values(guardedObjects).some(guardedObject => guardedObject.device_number === Number(number));
        const isDeviceExist = Object.values(devices).some(item => item.number === Number(number));

        const response = [
            { condition: !number, message: STATUS_OK},
            { condition: !isObjectExist && isDeviceExist, message: t('createConectionAndCoordinates') },
            { condition: !isDeviceExist, message: `${t('CIE')} №${number} ${t('notExist')}` },
            { condition: !filteredObjects.length, message: t('clearOtherFilters') },
            { condition: filteredObjects[0] && !isCoordinateCorrectly(filteredObjects[0]), message: t('objectWithoutCoordinates') },
        ].find(item => item.condition);
        
        if (response) return response.message;
        
        return STATUS_OK;
        
    }, [filteredObjects]);
    
    useEffect(() => {
        if (deviceNumberTooltip !== STATUS_OK) {
            setCenter(START_MAP_CENTER);
            setCurrentZoom(CURRENT_MAP_ZOOM);
        }
    }, [deviceNumberTooltip]);

    // focus on single object while searching by number
    useEffect(() => {
        if (number !== null && filteredObjects?.length) {
            const firstObject = filteredObjects[0];
            const lat = Number(firstObject.lat);
            const lng = Number(firstObject.long);
            if (isCoordinateCorrectly(firstObject)) {
                setCenter({ lat, lng });
                setCurrentZoom(INCREASED_ZOOM);
            } else {
                setCenter(START_MAP_CENTER);
                setCurrentZoom(CURRENT_MAP_ZOOM);
            }
        }
    }, [filteredObjects]);

    const changeFilterStatusState = (data: Array<ChessStatus>) => {
        dispatch(filterActions.setMapFilter({ name: 'status', data }));
    };

    const clearFilterByStatus = () => dispatch(filterActions.setMapSomeFilterClear('status'));

    const changeFilterTypeState = (data: DevicesTypes) => dispatch(filterActions.setMapFilter({ name: 'type', data }));

    const clearFilterByType = () => dispatch(filterActions.setMapSomeFilterClear('type'));

    const changeFilterNumberState = (data: string) => {
        if (data === '') {
            setCenter(START_MAP_CENTER);
            setCurrentZoom(CURRENT_MAP_ZOOM);
        }
        dispatch(filterActions.setMapFilter({ name: 'number', data: data || null }));
    };

    const clearFilterByNumber = () => {
        setCenter(START_MAP_CENTER);
        setCurrentZoom(CURRENT_MAP_ZOOM);
        dispatch(filterActions.setMapSomeFilterClear('number'));
    };

    const handleClearAllFilters = () => dispatch(filterActions.setMapAllFilterClear());

    return (
        <div className={classNames({
            'wraper-h wraper-h--map': true,
            'full-wraper-h': !showRightTab
        })}>
            <div className='left-tape'>

                <Spinner show={showLoader} additionalClass='map-loader' />

                <div className='general-map'>
                    <LeafletMap
                        center={center}
                        zoom={currentZoom}
                        attributionControl={true}
                        zoomControl={true}
                        doubleClickZoom={true}
                        scrollWheelZoom={true}
                        dragging={true}
                        animate={true}
                        easeLinearity={0.35}
                        preferCanvas={true}
                        renderer={L.canvas()}
                    >
                        <TileLayer
                            url='https://{s}.tile.osm.org/{z}/{x}/{y}.png'
                        />
                        <FullscreenControl
                            position="topleft"
                            content={'&#8988;&#8989;\n&#8990;&#8991;'}
                        />
                        {filteredObjects?.map(filteredObject => {
                            const { obj_id, device_number, address } = filteredObject;
                            const lat = Number(filteredObject.lat);
                            const long = Number(filteredObject.long);
                            const neededColor = getMarkerColor(filteredObject);
                            if (isCoordinateCorrectly(filteredObject)) {
                                return (
                                    <Fragment key={obj_id}>
                                        <CircleMarker
                                            center={[lat, long]}
                                            fillColor={neededColor}
                                            radius={MARKER_RADIUS}
                                            color={WHITE}
                                            weight={MARKER_WEIGHT}
                                            fillOpacity={MARKER_FILL_OPACITY}
                                        >
                                            <Popup className='marker-popup'>
                                                <div>
                                                    <h2>{device_number}</h2>
                                                    <span>{`${t('GeneralTapeObjectAddress')}: ${address}`}</span>
                                                    <br />
                                                    <span>{`${t('coords')}: ${lat}, ${long}`}</span>
                                                </div>
                                            </Popup>
                                        </CircleMarker>
                                    </Fragment>
                                );
                            }
                            return null;
                        })}
                    </LeafletMap>
                </div>

                <OperatorPanelLegend
                    isMapModePanel
                    legendElements={legendElements}
                    deviceNumberTooltip={deviceNumberTooltip}
                    changeFilterStatusState={changeFilterStatusState}
                    clearFilterByStatus={clearFilterByStatus}
                    changeFilterTypeState={changeFilterTypeState}
                    clearFilterByType={clearFilterByType}
                    changeFilterNumberState={changeFilterNumberState}
                    clearFilterByNumber={clearFilterByNumber}
                    handleClearAllFilters={handleClearAllFilters}
                />
            </div>
        </div>
    );
};

const mapStateToProps = (state: STORE) => {
    const { guardedObjects, devices, generalTape, showLoader } = state.startAppData;
    const { mapFilter } = state.filter;

    return {
        guardedObjects,
        devices,
        generalTape,
        showLoader,
        mapFilter,
    };
};

export default connect(mapStateToProps)(MapModePage as FC);